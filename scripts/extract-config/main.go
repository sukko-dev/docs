// Command extract-config parses Go config structs and extracts env var
// definitions from struct tags. Outputs JSON for the docs config reference.
//
// Usage: go run . /path/to/sukko/ws
package main

import (
	"encoding/json"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"reflect"
	"strings"
)

type ConfigVar struct {
	Name        string `json:"name"`
	Type        string `json:"type"`
	Default     string `json:"default"`
	Description string `json:"description"`
}

type ServiceConfig struct {
	Name string      `json:"name"`
	File string      `json:"file"`
	Vars []ConfigVar `json:"vars"`
}

type Output struct {
	Services []ServiceConfig `json:"services"`
}

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintf(os.Stderr, "Usage: %s /path/to/sukko/ws\n", os.Args[0])
		os.Exit(1)
	}
	wsRoot := os.Args[1]

	configFiles := map[string]string{
		"gateway":      filepath.Join(wsRoot, "internal/shared/platform/gateway_config.go"),
		"server":       filepath.Join(wsRoot, "internal/shared/platform/server_config.go"),
		"provisioning": filepath.Join(wsRoot, "internal/shared/platform/provisioning_config.go"),
		"base":         filepath.Join(wsRoot, "internal/shared/platform/config.go"),
		"tester":       filepath.Join(wsRoot, "cmd/tester/config.go"),
	}

	output := Output{}
	var extractErrors []error

	for name, path := range configFiles {
		vars, err := extractFromFile(path)
		if err != nil {
			extractErrors = append(extractErrors, fmt.Errorf("%s: %w", name, err))
			continue
		}
		if len(vars) > 0 {
			output.Services = append(output.Services, ServiceConfig{
				Name: name,
				File: path,
				Vars: vars,
			})
		}
	}

	if len(extractErrors) > 0 {
		for _, e := range extractErrors {
			fmt.Fprintf(os.Stderr, "extract-config error: %v\n", e)
		}
		fmt.Fprintf(os.Stderr, "extract-config: fix the missing inline comments listed above, then re-run the docs build\n")
		os.Exit(1)
	}

	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	if err := enc.Encode(output); err != nil {
		fmt.Fprintf(os.Stderr, "error encoding JSON: %v\n", err)
		os.Exit(1)
	}
}

func extractFromFile(path string) ([]ConfigVar, error) {
	fset := token.NewFileSet()
	f, err := parser.ParseFile(fset, path, nil, parser.ParseComments)
	if err != nil {
		return nil, fmt.Errorf("parse %s: %w", path, err)
	}

	var vars []ConfigVar
	var missing []string

	ast.Inspect(f, func(n ast.Node) bool {
		ts, ok := n.(*ast.TypeSpec)
		if !ok {
			return true
		}
		st, ok := ts.Type.(*ast.StructType)
		if !ok {
			return true
		}

		for _, field := range st.Fields.List {
			if field.Tag == nil {
				continue
			}

			tag := reflect.StructTag(strings.Trim(field.Tag.Value, "`"))
			envName := tag.Get("env")
			if envName == "" || envName == "-" {
				continue
			}

			envDefault := tag.Get("envDefault")

			fieldType := "string"
			if field.Type != nil {
				fieldType = typeString(field.Type)
			}

			if field.Comment == nil {
				pos := fset.Position(field.Pos())
				fieldLabel := "<embedded>"
				if len(field.Names) > 0 {
					fieldLabel = field.Names[0].Name
				}
				missing = append(missing, fmt.Sprintf(
					"%s:%d: %s (env:%q) missing inline comment",
					filepath.Base(pos.Filename), pos.Line, fieldLabel, envName,
				))
				continue
			}

			vars = append(vars, ConfigVar{
				Name:        envName,
				Type:        fieldType,
				Default:     envDefault,
				Description: strings.TrimSpace(field.Comment.Text()),
			})
		}
		return true
	})

	if len(missing) > 0 {
		for _, m := range missing {
			fmt.Fprintln(os.Stderr, "extract-config: "+m+" — add an inline comment to fix the docs build")
		}
		return nil, fmt.Errorf("%d field(s) in %s missing inline comments", len(missing), filepath.Base(path))
	}

	return vars, nil
}

func typeString(expr ast.Expr) string {
	switch t := expr.(type) {
	case *ast.Ident:
		return t.Name
	case *ast.SelectorExpr:
		return typeString(t.X) + "." + t.Sel.Name
	case *ast.StarExpr:
		return "*" + typeString(t.X)
	case *ast.ArrayType:
		return "[]" + typeString(t.Elt)
	default:
		return "unknown"
	}
}
