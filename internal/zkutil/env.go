package zkutil

import (
	"bufio"
	"fmt"
	"log"
	"os"
	"strings"
)

func LoadDotEnv(path string) {
	file, err := os.Open(path)
	if err != nil {
		return
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		if key == "" || os.Getenv(key) != "" {
			continue
		}
		value = strings.Trim(strings.TrimSpace(value), `"'`)
		if err := os.Setenv(key, value); err != nil {
			log.Fatalf("set env %s: %v", key, err)
		}
	}
	if err := scanner.Err(); err != nil {
		log.Fatalf("read %s: %v", path, err)
	}
}

func MustUint64FromEnv(name string) uint64 {
	value := os.Getenv(name)
	if value == "" {
		log.Fatalf("%s env var required", name)
	}

	var parsed uint64
	if _, err := fmt.Sscanf(value, "%d", &parsed); err != nil {
		log.Fatalf("parse %s=%q: %v", name, value, err)
	}
	return parsed
}
