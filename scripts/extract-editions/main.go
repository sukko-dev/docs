// Command extract-editions parses the license package and extracts:
// 1. Edition limits from DefaultLimits() in limits.go
// 2. Feature gates from featureEditions map in features.go
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

type FeatureGate struct {
	Name    string `json:"name"`
	Edition string `json:"edition"`
}

type Output struct {
	Editions []EditionLimits `json:"editions"`
	Features []FeatureGate   `json:"features"`
}

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintf(os.Stderr, "Usage: %s /path/to/sukko/ws\n", os.Args[0])
		os.Exit(1)
	}
	wsRoot := os.Args[1]
	licenseDir := filepath.Join(wsRoot, "internal/shared/license")

	editions, err := extractEditions(filepath.Join(licenseDir, "limits.go"))
	if err != nil {
		fmt.Fprintf(os.Stderr, "error extracting editions: %v\n", err)
		os.Exit(1)
	}

	features, err := extractFeatures(filepath.Join(licenseDir, "features.go"))
	if err != nil {
		fmt.Fprintf(os.Stderr, "error extracting features: %v\n", err)
		os.Exit(1)
	}

	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	if err := enc.Encode(Output{Editions: editions, Features: features}); err != nil {
		fmt.Fprintf(os.Stderr, "error encoding JSON: %v\n", err)
		os.Exit(1)
	}
}

func extractFeatures(path string) ([]FeatureGate, error) {
	fset := token.NewFileSet()
	f, err := parser.ParseFile(fset, path, nil, parser.ParseComments)
	if err != nil {
		return nil, fmt.Errorf("parse %s: %w", path, err)
	}

	// Step 1: Build map of const name → string value from Feature constants
	constValues := map[string]string{}
	ast.Inspect(f, func(n ast.Node) bool {
		genDecl, ok := n.(*ast.GenDecl)
		if !ok || genDecl.Tok.String() != "const" {
			return true
		}
		for _, spec := range genDecl.Specs {
			vs, ok := spec.(*ast.ValueSpec)
			if !ok || len(vs.Names) == 0 || len(vs.Values) == 0 {
				continue
			}
			if lit, ok := vs.Values[0].(*ast.BasicLit); ok {
				constValues[vs.Names[0].Name] = strings.Trim(lit.Value, "\"")
			}
		}
		return true
	})

	// Step 2: Parse featureEditions map, resolve const names to string values
	var features []FeatureGate
	ast.Inspect(f, func(n ast.Node) bool {
		genDecl, ok := n.(*ast.GenDecl)
		if !ok {
			return true
		}
		for _, spec := range genDecl.Specs {
			vs, ok := spec.(*ast.ValueSpec)
			if !ok || len(vs.Names) == 0 || vs.Names[0].Name != "featureEditions" {
				continue
			}
			if len(vs.Values) == 0 {
				continue
			}
			comp, ok := vs.Values[0].(*ast.CompositeLit)
			if !ok {
				continue
			}
			for _, elt := range comp.Elts {
				kv, ok := elt.(*ast.KeyValueExpr)
				if !ok {
					continue
				}
				keyIdent, ok := kv.Key.(*ast.Ident)
				if !ok {
					continue
				}
				editionName := identName(kv.Value)

				// Resolve const name to its string value
				featureName := constValues[keyIdent.Name]
				if featureName == "" {
					featureName = keyIdent.Name
				}

				if editionName != "" {
					features = append(features, FeatureGate{
						Name:    featureName,
						Edition: editionName,
					})
				}
			}
		}
		return true
	})

	return features, nil
}

func extractEditions(path string) ([]EditionLimits, error) {
	fset := token.NewFileSet()
	f, err := parser.ParseFile(fset, path, nil, parser.ParseComments)
	if err != nil {
		return nil, fmt.Errorf("parse %s: %w", path, err)
	}

	var editions []EditionLimits

	ast.Inspect(f, func(n ast.Node) bool {
		funcDecl, ok := n.(*ast.FuncDecl)
		if !ok || funcDecl.Name.Name != "DefaultLimits" {
			return true
		}

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
		if lit, ok := v.X.(*ast.BasicLit); ok {
			n, _ := strconv.Atoi(lit.Value)
			return -n
		}
	}
	return 0
}
