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
	Name  string      `json:"name"`
	Files []string    `json:"files"`
	Vars  []ConfigVar `json:"vars"`
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
	platformDir := filepath.Join(wsRoot, "internal/shared/platform")

	// Ordered slice (not a map): Go map iteration order is randomized, which would
	// reshuffle output.Services on every run and produce huge spurious diffs in the
	// generated config-reference.json. A fixed order keeps generation deterministic
	// and preserves the intended documentation section order.
	configFiles := []struct {
		name  string
		paths []string
	}{
		{"base", []string{filepath.Join(platformDir, "config.go")}},
		{"gateway", []string{filepath.Join(platformDir, "gateway_config.go")}},
		{"server", []string{filepath.Join(platformDir, "server_config.go")}},
		{"provisioning", []string{filepath.Join(platformDir, "provisioning_config.go")}},
		{"webhook-shared", []string{
			filepath.Join(platformDir, "webhook_http_config.go"),
			filepath.Join(platformDir, "webhook_internal_token_config.go"),
			filepath.Join(platformDir, "credentials_config.go"),
		}},
		{"webhook-worker", []string{
			filepath.Join(platformDir, "webhook_worker_config.go"),
			filepath.Join(platformDir, "grpc_reconnect_config.go"),
		}},
		{"tester", []string{filepath.Join(wsRoot, "cmd/tester/config.go")}},
	}

	output := Output{}
	var extractErrors []error

	for _, cf := range configFiles {
		name, paths := cf.name, cf.paths
		var allVars []ConfigVar
		var fileList []string
		for _, path := range paths {
			vars, err := extractFromFile(path, platformDir)
			if err != nil {
				extractErrors = append(extractErrors, fmt.Errorf("%s %s: %w", name, path, err))
				continue
			}
			allVars = append(allVars, vars...)
			fileList = append(fileList, path)
		}
		if len(allVars) > 0 {
			output.Services = append(output.Services, ServiceConfig{
				Name:  name,
				Files: fileList,
				Vars:  allVars,
			})
		}
	}

	if len(extractErrors) > 0 {
		for _, e := range extractErrors {
			fmt.Fprintf(os.Stderr, "extract-config error: %v\n", e)
		}
		fmt.Fprintf(os.Stderr, "extract-config: aborting due to parse/walk errors above\n")
		os.Exit(1)
	}

	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	if err := enc.Encode(output); err != nil {
		fmt.Fprintf(os.Stderr, "error encoding JSON: %v\n", err)
		os.Exit(1)
	}
}

func extractFromFile(path, platformDir string) ([]ConfigVar, error) {
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

			// envPrefix expansion: only triggered for named fields with envPrefix tag.
			// Anonymous embedded structs without envPrefix are handled by listing their
			// defining files explicitly in configFiles — NOT by this expansion path.
			// Mixing both mechanisms for the same struct would double-list its vars.
			if prefix := tag.Get("envPrefix"); prefix != "" {
				typeName := typeString(field.Type)
				expanded, expandErr := expandEnvPrefix(typeName, prefix, platformDir)
				if expandErr != nil {
					fmt.Fprintf(os.Stderr, "extract-config: warning: envPrefix expansion for %s: %v\n", typeName, expandErr)
				} else {
					vars = append(vars, expanded...)
				}
				continue
			}

			envName := tag.Get("env")
			if envName == "" || envName == "-" {
				continue
			}

			envDefault := tag.Get("envDefault")

			fieldType := "string"
			if field.Type != nil {
				fieldType = typeString(field.Type)
			}

			description := ""
			if field.Comment != nil {
				description = strings.TrimSpace(field.Comment.Text())
			} else {
				pos := fset.Position(field.Pos())
				fieldLabel := "<embedded>"
				if len(field.Names) > 0 {
					fieldLabel = field.Names[0].Name
				}
				missing = append(missing, fmt.Sprintf(
					"%s:%d: %s (env:%q) missing inline comment",
					filepath.Base(pos.Filename), pos.Line, fieldLabel, envName,
				))
			}

			vars = append(vars, ConfigVar{
				Name:        envName,
				Type:        fieldType,
				Default:     envDefault,
				Description: description,
			})
		}
		return true
	})

	if len(missing) > 0 {
		for _, m := range missing {
			fmt.Fprintln(os.Stderr, "extract-config: warning: "+m)
		}
	}

	return vars, nil
}

// expandEnvPrefix finds typeName in platformDir and returns its env var fields
// with prefix prepended to each env var name.
// Only called when a struct field carries an envPrefix tag.
func expandEnvPrefix(typeName, prefix, platformDir string) ([]ConfigVar, error) {
	entries, err := os.ReadDir(platformDir)
	if err != nil {
		return nil, fmt.Errorf("read dir %s: %w", platformDir, err)
	}

	fset := token.NewFileSet()
	for _, entry := range entries {
		name := entry.Name()
		if entry.IsDir() || !strings.HasSuffix(name, ".go") || strings.HasSuffix(name, "_test.go") {
			continue
		}
		f, err := parser.ParseFile(fset, filepath.Join(platformDir, name), nil, parser.ParseComments)
		if err != nil {
			return nil, fmt.Errorf("parse file %s: %w", name, err)
		}
		for _, decl := range f.Decls {
			gd, ok := decl.(*ast.GenDecl)
			if !ok {
				continue
			}
			for _, spec := range gd.Specs {
				ts, ok := spec.(*ast.TypeSpec)
				if !ok {
					continue
				}
				if ts.Name.Name != typeName {
					continue
				}
				st, ok := ts.Type.(*ast.StructType)
				if !ok {
					continue
				}
				var vars []ConfigVar
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

					description := ""
					if field.Comment != nil {
						description = strings.TrimSpace(field.Comment.Text())
					}

					vars = append(vars, ConfigVar{
						Name:        prefix + envName,
						Type:        fieldType,
						Default:     envDefault,
						Description: description,
					})
				}
				return vars, nil
			}
		}
	}
	return nil, fmt.Errorf("type %s not found in %s", typeName, platformDir)
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
