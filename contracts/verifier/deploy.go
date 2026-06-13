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

	approvalProgram := compileTEAL(client, "contracts/verifier/Verifier.approval.teal")
	clearProgram := compileTEAL(client, "contracts/verifier/Verifier.clear.teal")

	params, err := client.SuggestedParams().Do(context.Background())
	if err != nil {
		log.Fatalf("suggested params: %v", err)
	}

	log.Printf("compiled verifier approval program: %d bytes", len(approvalProgram))
	log.Printf("compiled verifier clear program: %d bytes", len(clearProgram))

	txn, err := transaction.MakeApplicationCreateTxWithExtraPages(
		false,
		approvalProgram,
		clearProgram,
		types.StateSchema{NumUint: 1, NumByteSlice: 1},
		types.StateSchema{},
		createArgs(),
		nil,
		nil,
		nil,
		params,
		account.Address,
		nil,
		types.Digest{},
		[32]byte{},
		types.Address{},
		3,
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

	fmt.Printf("Verifier deployed. App ID: %d\n", result.ApplicationIndex)
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

func createArgs() [][]byte {
	method, err := abi.MethodFromSignature("create(string)void")
	if err != nil {
		log.Fatalf("create method signature: %v", err)
	}
	stringType, err := abi.TypeOf("string")
	if err != nil {
		log.Fatalf("string ABI type: %v", err)
	}
	name, err := stringType.Encode("NexusVerifier")
	if err != nil {
		log.Fatalf("encode verifier name: %v", err)
	}
	return [][]byte{method.GetSelector(), name}
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
