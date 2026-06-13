package main

import (
	"bufio"
	"context"
	"encoding/base64"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/algorand/go-algorand-sdk/v2/abi"
	"github.com/algorand/go-algorand-sdk/v2/client/v2/algod"
	"github.com/algorand/go-algorand-sdk/v2/crypto"
	"github.com/algorand/go-algorand-sdk/v2/mnemonic"
	"github.com/algorand/go-algorand-sdk/v2/transaction"
	"github.com/algorand/go-algorand-sdk/v2/types"
)

const testnetAlgodURL = "https://testnet-api.algonode.cloud"
const testnetAlgodToken = ""

func main() {
	loadDotEnv(".env.zk")

	deployerMnemonic := os.Getenv("DEPLOYER_MNEMONIC")
	if deployerMnemonic == "" {
		log.Fatal("DEPLOYER_MNEMONIC env var required")
	}

	verifierAppID := uint64FromEnv("VERIFIER_APP_ID")

	privateKey, err := mnemonic.ToPrivateKey(deployerMnemonic)
	if err != nil {
		log.Fatalf("private key from mnemonic: %v", err)
	}
	account, err := crypto.AccountFromPrivateKey(privateKey)
	if err != nil {
		log.Fatalf("account from private key: %v", err)
	}

	client, err := algod.MakeClient(testnetAlgodURL, testnetAlgodToken)
	if err != nil {
		log.Fatalf("algod client: %v", err)
	}

	approvalProgram := compileTEAL(client, "contracts/credential_store/NexusCredentialStore.approval.teal")
	clearProgram := compileTEAL(client, "contracts/credential_store/NexusCredentialStore.clear.teal")

	params, err := client.SuggestedParams().Do(context.Background())
	if err != nil {
		log.Fatalf("suggested params: %v", err)
	}

	txn, err := transaction.MakeApplicationCreateTx(
		false,
		approvalProgram,
		clearProgram,
		types.StateSchema{NumUint: 1},
		types.StateSchema{},
		createArgs(verifierAppID),
		nil,
		nil,
		nil,
		params,
		account.Address,
		nil,
		types.Digest{},
		[32]byte{},
		types.Address{},
	)
	if err != nil {
		log.Fatalf("make app create transaction: %v", err)
	}

	txID, signedTxn, err := crypto.SignTransaction(account.PrivateKey, txn)
	if err != nil {
		log.Fatalf("sign transaction: %v", err)
	}

	if _, err := client.SendRawTransaction(signedTxn).Do(context.Background()); err != nil {
		log.Fatalf("send transaction %s: %v", txID, err)
	}

	result, err := transaction.WaitForConfirmation(client, txID, 4, context.Background())
	if err != nil {
		log.Fatalf("wait for confirmation: %v", err)
	}

	fmt.Printf("Credential store deployed. App ID: %d\n", result.ApplicationIndex)
}

func loadDotEnv(path string) {
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

func compileTEAL(client *algod.Client, path string) []byte {
	source, err := os.ReadFile(path)
	if err != nil {
		log.Fatalf("read %s: %v", path, err)
	}

	result, err := client.TealCompile(source).Do(context.Background())
	if err != nil {
		log.Fatalf("compile %s: %v", path, err)
	}

	program, err := base64.StdEncoding.DecodeString(result.Result)
	if err != nil {
		log.Fatalf("decode compiled %s: %v", path, err)
	}
	return program
}

func uint64FromEnv(name string) uint64 {
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

func createArgs(verifierAppID uint64) [][]byte {
	method, err := abi.MethodFromSignature("create(uint64)void")
	if err != nil {
		log.Fatalf("create method signature: %v", err)
	}
	uint64Type, err := abi.TypeOf("uint64")
	if err != nil {
		log.Fatalf("uint64 ABI type: %v", err)
	}
	encodedVerifierAppID, err := uint64Type.Encode(verifierAppID)
	if err != nil {
		log.Fatalf("encode verifier app id: %v", err)
	}
	return [][]byte{method.GetSelector(), encodedVerifierAppID}
}
