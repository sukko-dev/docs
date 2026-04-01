// Command extract-cli parses sukko-cli cobra command source files and extracts
// command definitions. Outputs JSON for the docs CLI reference.
//
// Usage: go run . /path/to/sukko-cli
package main

import (
	"encoding/json"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"strings"
)

type Flag struct {
	Name     string `json:"name"`
	Short    string `json:"shorthand,omitempty"`
	Type     string `json:"type"`
	Default  string `json:"default,omitempty"`
	Usage    string `json:"usage"`
}

type Command struct {
	Name    string    `json:"name"`
	Use     string    `json:"use"`
	Short   string    `json:"short"`
	Long    string    `json:"long,omitempty"`
	Example string    `json:"example,omitempty"`
	Aliases []string  `json:"aliases,omitempty"`
	Flags   []Flag    `json:"flags,omitempty"`
	File    string    `json:"file"`
}

type Output struct {
	Commands []Command `json:"commands"`
}

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintf(os.Stderr, "Usage: %s /path/to/sukko-cli\n", os.Args[0])
		os.Exit(1)
	}
	cliRoot := os.Args[1]
	commandsDir := filepath.Join(cliRoot, "commands")

	entries, err := os.ReadDir(commandsDir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error reading %s: %v\n", commandsDir, err)
		os.Exit(1)
	}

	output := Output{}

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".go") || strings.HasSuffix(entry.Name(), "_test.go") {
			continue
		}

		path := filepath.Join(commandsDir, entry.Name())
		cmds, err := extractCommands(path)
		if err != nil {
			fmt.Fprintf(os.Stderr, "warning: %s: %v\n", entry.Name(), err)
			continue
		}
		output.Commands = append(output.Commands, cmds...)
	}

	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	if err := enc.Encode(output); err != nil {
		fmt.Fprintf(os.Stderr, "error encoding JSON: %v\n", err)
		os.Exit(1)
	}
}

func extractCommands(path string) ([]Command, error) {
	fset := token.NewFileSet()
	f, err := parser.ParseFile(fset, path, nil, parser.ParseComments)
	if err != nil {
		return nil, fmt.Errorf("parse %s: %w", path, err)
	}

	var commands []Command

	ast.Inspect(f, func(n ast.Node) bool {
		// Look for &cobra.Command{...} composite literals
		unary, ok := n.(*ast.UnaryExpr)
		if !ok {
			return true
		}
		comp, ok := unary.X.(*ast.CompositeLit)
		if !ok {
			return true
		}

		// Check if it's cobra.Command
		sel, ok := comp.Type.(*ast.SelectorExpr)
		if !ok {
			return true
		}
		if sel.Sel.Name != "Command" {
			return true
		}
		ident, ok := sel.X.(*ast.Ident)
		if !ok || ident.Name != "cobra" {
			return true
		}

		cmd := Command{File: filepath.Base(path)}

		for _, elt := range comp.Elts {
			kv, ok := elt.(*ast.KeyValueExpr)
			if !ok {
				continue
			}
			key, ok := kv.Key.(*ast.Ident)
			if !ok {
				continue
			}

			switch key.Name {
			case "Use":
				cmd.Use = stringLitValue(kv.Value)
				parts := strings.Fields(cmd.Use)
				if len(parts) > 0 {
					cmd.Name = parts[0]
				}
			case "Short":
				cmd.Short = stringLitValue(kv.Value)
			case "Long":
				cmd.Long = stringLitValue(kv.Value)
			case "Example":
				cmd.Example = stringLitValue(kv.Value)
			case "Aliases":
				cmd.Aliases = stringSliceValue(kv.Value)
			}
		}

		if cmd.Name != "" {
			commands = append(commands, cmd)
		}
		return true
	})

	return commands, nil
}

func stringLitValue(expr ast.Expr) string {
	switch v := expr.(type) {
	case *ast.BasicLit:
		s := v.Value
		if strings.HasPrefix(s, "`") {
			return strings.Trim(s, "`")
		}
		return strings.Trim(s, "\"")
	default:
		return ""
	}
}

func stringSliceValue(expr ast.Expr) []string {
	comp, ok := expr.(*ast.CompositeLit)
	if !ok {
		return nil
	}
	var result []string
	for _, elt := range comp.Elts {
		if s := stringLitValue(elt); s != "" {
			result = append(result, s)
		}
	}
	return result
}
