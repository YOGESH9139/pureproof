package main

import (
	"context"
	"encoding/base64"
	"fmt"
	"log"
	"os"

	"github.com/algorand/go-algorand-sdk/v2/client/v2/algod"
	"github.com/algorand/go-algorand-sdk/v2/crypto"
	"github.com/algorand/go-algorand-sdk/v2/mnemonic"
	"github.com/algorand/go-algorand-sdk/v2/transaction"
	"github.com/algorand/go-algorand-sdk/v2/types"
	"nexusid/internal/zkutil"
)

const (
	algodURL   = "https://testnet-api.algonode.cloud"
	algodToken = ""
)

const approvalSource = `#pragma version 8
int 1
`

const clearSource = `#pragma version 8
int 1
`

func main() {
	zkutil.LoadDotEnv(".env.zk")

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

	client, err := algod.MakeClient(algodURL, algodToken)
	if err != nil {
		log.Fatalf("algod client: %v", err)
	}

	approvalProgram := compileTEAL(client, []byte(approvalSource))
	clearProgram := compileTEAL(client, []byte(clearSource))
	params, err := client.SuggestedParams().Do(context.Background())
	if err != nil {
		log.Fatalf("suggested params: %v", err)
	}

	txn, err := transaction.MakeApplicationCreateTx(
		false,
		approvalProgram,
		clearProgram,
		types.StateSchema{},
		types.StateSchema{},
		nil,
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
		log.Fatalf("make budget app create: %v", err)
	}

	txID, signedTxn, err := crypto.SignTransaction(account.PrivateKey, txn)
	if err != nil {
		log.Fatalf("sign budget app create: %v", err)
	}
	if _, err := client.SendRawTransaction(signedTxn).Do(context.Background()); err != nil {
		log.Fatalf("send budget app create %s: %v", txID, err)
	}
	result, err := transaction.WaitForConfirmation(client, txID, 4, context.Background())
	if err != nil {
		log.Fatalf("wait for budget app confirmation: %v", err)
	}
	fmt.Printf("Budget app deployed. App ID: %d\n", result.ApplicationIndex)
}

func compileTEAL(client *algod.Client, source []byte) []byte {
	result, err := client.TealCompile(source).Do(context.Background())
	if err != nil {
		log.Fatalf("compile TEAL: %v", err)
	}
	program, err := base64.StdEncoding.DecodeString(result.Result)
	if err != nil {
		log.Fatalf("decode compiled TEAL: %v", err)
	}
	return program
}
