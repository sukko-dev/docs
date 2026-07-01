package main

import (
	"os"
	"path/filepath"
	"slices"
	"testing"
)

// writeFile is a test helper that writes content to a file, creating parent dirs.
func writeFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("mkdir %s: %v", filepath.Dir(path), err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("write %s: %v", path, err)
	}
}

// TestExtractFromFile_MultiFile verifies that extracting from multiple files
// per service produces a merged ConfigVar list with no duplicates.
func TestExtractFromFile_MultiFile(t *testing.T) {
	dir := t.TempDir()

	writeFile(t, filepath.Join(dir, "http_config.go"), `package platform

type WebhookHTTPConfig struct {
	AllowHTTP bool `+"`"+`env:"WEBHOOK_ALLOW_HTTP" envDefault:"false"`+"`"+` // Allow plain HTTP webhooks.
}
`)

	writeFile(t, filepath.Join(dir, "token_config.go"), `package platform

type WebhookTokenConfig struct {
	Token string `+"`"+`env:"WEBHOOK_INTERNAL_TOKEN" redact:"true"`+"`"+` // Shared secret for internal auth.
}
`)

	httpVars, err := extractFromFile(filepath.Join(dir, "http_config.go"), dir)
	if err != nil {
		t.Fatalf("extractFromFile http: %v", err)
	}
	tokenVars, err := extractFromFile(filepath.Join(dir, "token_config.go"), dir)
	if err != nil {
		t.Fatalf("extractFromFile token: %v", err)
	}

	allVars := append(httpVars, tokenVars...)
	if len(allVars) != 2 {
		t.Fatalf("expected 2 merged vars, got %d: %v", len(allVars), allVars)
	}

	names := make([]string, len(allVars))
	for i, v := range allVars {
		names[i] = v.Name
	}
	if !slices.Contains(names, "WEBHOOK_ALLOW_HTTP") {
		t.Errorf("merged vars missing WEBHOOK_ALLOW_HTTP: %v", names)
	}
	if !slices.Contains(names, "WEBHOOK_INTERNAL_TOKEN") {
		t.Errorf("merged vars missing WEBHOOK_INTERNAL_TOKEN: %v", names)
	}

	// No duplicates.
	seen := make(map[string]bool)
	for _, n := range names {
		if seen[n] {
			t.Errorf("duplicate var name in merged output: %s", n)
		}
		seen[n] = true
	}
}

// TestExtractFromFile_EnvPrefixExpansion verifies that a struct field with
// envPrefix:"WEBHOOK_WORKER_" causes the referenced type's fields to be emitted
// as WEBHOOK_WORKER_VALKEY_ADDRS etc. (not bare VALKEY_ADDRS).
func TestExtractFromFile_EnvPrefixExpansion(t *testing.T) {
	dir := t.TempDir()

	// ValkeyClientConfig defined in a separate file (as in the real codebase).
	writeFile(t, filepath.Join(dir, "valkey_config.go"), `package platform

type ValkeyClientConfig struct {
	Addrs    []string `+"`"+`env:"VALKEY_ADDRS" envSeparator:","`+"`"+` // Valkey addresses.
	Password string   `+"`"+`env:"VALKEY_PASSWORD" redact:"true"`+"`"+` // Valkey password.
	TLS      bool     `+"`"+`env:"VALKEY_TLS_ENABLED" envDefault:"false"`+"`"+` // Enable TLS.
}
`)

	// WebhookWorkerConfig in its own file, referencing ValkeyClientConfig via envPrefix.
	writeFile(t, filepath.Join(dir, "worker_config.go"), `package platform

type WebhookWorkerConfig struct {
	Concurrency int `+"`"+`env:"WEBHOOK_WORKER_CONCURRENCY" envDefault:"50"`+"`"+` // Max concurrent goroutines.
	// ValkeyConfig uses envPrefix to namespace Valkey vars for this service.
	ValkeyConfig ValkeyClientConfig `+"`"+`envPrefix:"WEBHOOK_WORKER_"`+"`"+`
}
`)

	vars, err := extractFromFile(filepath.Join(dir, "worker_config.go"), dir)
	if err != nil {
		t.Fatalf("extractFromFile: %v", err)
	}

	names := make([]string, len(vars))
	for i, v := range vars {
		names[i] = v.Name
	}

	// Direct field on WebhookWorkerConfig.
	if !slices.Contains(names, "WEBHOOK_WORKER_CONCURRENCY") {
		t.Errorf("missing WEBHOOK_WORKER_CONCURRENCY in %v", names)
	}

	// Prefixed fields from ValkeyClientConfig.
	want := []string{"WEBHOOK_WORKER_VALKEY_ADDRS", "WEBHOOK_WORKER_VALKEY_PASSWORD", "WEBHOOK_WORKER_VALKEY_TLS_ENABLED"}
	for _, w := range want {
		if !slices.Contains(names, w) {
			t.Errorf("missing %s in %v", w, names)
		}
	}

	// Bare VALKEY_* names must NOT appear — that would indicate the prefix was not applied.
	bare := []string{"VALKEY_ADDRS", "VALKEY_PASSWORD", "VALKEY_TLS_ENABLED"}
	for _, b := range bare {
		if slices.Contains(names, b) {
			t.Errorf("bare var %s present — prefix was not applied", b)
		}
	}
}

// TestExpandEnvPrefix_TypeNotFound verifies an error is returned when the type
// is not in the platform directory (guard against silent empty expansion).
func TestExpandEnvPrefix_TypeNotFound(t *testing.T) {
	dir := t.TempDir()
	writeFile(t, filepath.Join(dir, "placeholder.go"), "package platform\n")

	_, err := expandEnvPrefix("NonExistentType", "PREFIX_", dir)
	if err == nil {
		t.Fatal("expected error for missing type, got nil")
	}
}

// TestExtractFromFile_EnvPrefixNoBareNames verifies the CRITICAL constraint:
// anonymous embedded structs without envPrefix do NOT trigger ParseDir expansion.
// If both mechanisms fired for the same struct, vars would appear twice.
func TestExtractFromFile_EnvPrefixNoBareNames(t *testing.T) {
	dir := t.TempDir()

	writeFile(t, filepath.Join(dir, "grpc_config.go"), `package platform

type GRPCReconnectConfig struct {
	Delay    string `+"`"+`env:"PROVISIONING_GRPC_RECONNECT_DELAY" envDefault:"1s"`+"`"+` // Initial reconnect delay.
	MaxDelay string `+"`"+`env:"PROVISIONING_GRPC_RECONNECT_MAX_DELAY" envDefault:"30s"`+"`"+` // Max reconnect delay.
}
`)

	// WebhookWorkerConfig embeds GRPCReconnectConfig without envPrefix.
	// grpc_reconnect_config.go is listed EXPLICITLY in configFiles["webhook-worker"]
	// so its vars appear once from that file — not via envPrefix expansion.
	writeFile(t, filepath.Join(dir, "worker_no_prefix.go"), `package platform

type WebhookWorkerConfigNoPrefix struct {
	GRPCReconnectConfig
	Port int `+"`"+`env:"WEBHOOK_HTTP_PORT" envDefault:"8083"`+"`"+` // HTTP port.
}
`)

	// Extracting worker_no_prefix.go: GRPCReconnectConfig has no tag → skipped.
	// Port has env tag → extracted. No ParseDir expansion for the embedded struct.
	vars, err := extractFromFile(filepath.Join(dir, "worker_no_prefix.go"), dir)
	if err != nil {
		t.Fatalf("extractFromFile: %v", err)
	}
	names := make([]string, len(vars))
	for i, v := range vars {
		names[i] = v.Name
	}

	// Only the direct field should appear.
	if len(vars) != 1 || vars[0].Name != "WEBHOOK_HTTP_PORT" {
		t.Errorf("expected only WEBHOOK_HTTP_PORT, got %v", names)
	}
}
