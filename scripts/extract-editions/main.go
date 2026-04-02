// Command extract-editions parses the DefaultLimits function from the license
// package and extracts edition limit values. Outputs JSON for the docs editions page.
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
	"strconv"
	"strings"
)

type EditionLimits struct {
	Edition                  string `json:"edition"`
	MaxTenants               int    `json:"max_tenants"`
	MaxTotalConnections      int    `json:"max_total_connections"`
	MaxShards                int    `json:"max_shards"`
	MaxTopicsPerTenant       int    `json:"max_topics_per_tenant"`
	MaxRoutingRulesPerTenant int    `json:"max_routing_rules_per_tenant"`
}

type Output struct {
	Editions []EditionLimits `json:"editions"`
}

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintf(os.Stderr, "Usage: %s /path/to/sukko/ws\n", os.Args[0])
		os.Exit(1)
	}
	wsRoot := os.Args[1]
	limitsFile := filepath.Join(wsRoot, "internal/shared/license/limits.go")

	editions, err := extractEditions(limitsFile)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	if err := enc.Encode(Output{Editions: editions}); err != nil {
		fmt.Fprintf(os.Stderr, "error encoding JSON: %v\n", err)
		os.Exit(1)
	}
}

func extractEditions(path string) ([]EditionLimits, error) {
	fset := token.NewFileSet()
	f, err := parser.ParseFile(fset, path, nil, parser.ParseComments)
	if err != nil {
		return nil, fmt.Errorf("parse %s: %w", path, err)
	}

	var editions []EditionLimits

	ast.Inspect(f, func(n ast.Node) bool {
		// Find the DefaultLimits function
		funcDecl, ok := n.(*ast.FuncDecl)
		if !ok || funcDecl.Name.Name != "DefaultLimits" {
			return true
		}

		// Walk the function body for return statements with Limits{...}
		ast.Inspect(funcDecl.Body, func(inner ast.Node) bool {
			ret, ok := inner.(*ast.ReturnStmt)
			if !ok || len(ret.Results) == 0 {
				return true
			}

			comp, ok := ret.Results[0].(*ast.CompositeLit)
			if !ok {
				return true
			}

			limits := EditionLimits{}
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
				case "Edition":
					limits.Edition = identName(kv.Value)
				case "MaxTenants":
					limits.MaxTenants = intValue(kv.Value)
				case "MaxTotalConnections":
					limits.MaxTotalConnections = intValue(kv.Value)
				case "MaxShards":
					limits.MaxShards = intValue(kv.Value)
				case "MaxTopicsPerTenant":
					limits.MaxTopicsPerTenant = intValue(kv.Value)
				case "MaxRoutingRulesPerTenant":
					limits.MaxRoutingRulesPerTenant = intValue(kv.Value)
				}
			}

			if limits.Edition != "" {
				editions = append(editions, limits)
			}
			return true
		})

		return false
	})

	return editions, nil
}

func identName(expr ast.Expr) string {
	if id, ok := expr.(*ast.Ident); ok {
		return strings.ToLower(id.Name)
	}
	return ""
}

func intValue(expr ast.Expr) int {
	switch v := expr.(type) {
	case *ast.BasicLit:
		n, _ := strconv.Atoi(v.Value)
		return n
	case *ast.UnaryExpr:
		// Handle negative numbers or expressions like -1
		if lit, ok := v.X.(*ast.BasicLit); ok {
			n, _ := strconv.Atoi(lit.Value)
			return -n
		}
	}
	return 0
}
