import * as grpc from '@grpc/grpc-js';
import { connect, hash, signers, Contract, Signer } from '@hyperledger/fabric-gateway';
import * as crypto from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import { TextDecoder } from 'util';
import envOrDefault from './envOrDefault';

export class FabricClient {
    private channelName: string;
    private chaincodeName: string;
    private mspId: string;
    private cryptoPath: string;
    private keyDirectoryPath: string;
    private certDirectoryPath: string;
    private tlsCertPath: string;
    private peerEndpoint: string;
    private peerHostAlias: string;
    private utf8Decoder: TextDecoder;

    constructor() {
        this.channelName = envOrDefault('CHANNEL_NAME', 'mychannel');
        this.chaincodeName = envOrDefault('CHAINCODE_NAME', 'rootlab3');
        this.mspId = envOrDefault('MSP_ID', 'Org1MSP');
        this.cryptoPath = envOrDefault(
            'CRYPTO_PATH',
            path.resolve(__dirname, '..', '..', '..', 'test-network', 'organizations', 'peerOrganizations', 'org1.example.com')
        );
        this.keyDirectoryPath = envOrDefault(
            'KEY_DIRECTORY_PATH',
            path.resolve(this.cryptoPath, 'users', 'User1@org1.example.com', 'msp', 'keystore')
        );
        this.certDirectoryPath = envOrDefault(
            'CERT_DIRECTORY_PATH',
            path.resolve(this.cryptoPath, 'users', 'User1@org1.example.com', 'msp', 'signcerts')
        );
        this.tlsCertPath = envOrDefault(
            'TLS_CERT_PATH',
            path.resolve(this.cryptoPath, 'peers', 'peer0.org1.example.com', 'tls', 'ca.crt')
        );
        this.peerEndpoint = envOrDefault('PEER_ENDPOINT', 'localhost:7051');
        this.peerHostAlias = envOrDefault('PEER_HOST_ALIAS', 'peer0.org1.example.com');
        this.utf8Decoder = new TextDecoder();
    }

    private async newGrpcConnection(): Promise<grpc.Client> {
        const tlsRootCert = await fs.readFile(this.tlsCertPath);
        const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
        return new grpc.Client(this.peerEndpoint, tlsCredentials, {
            'grpc.ssl_target_name_override': this.peerHostAlias,
        });
    }

    private async getFirstDirFileName(dirPath: string): Promise<string> {
        const files = await fs.readdir(dirPath);
        const file = files[0];
        if (!file) {
            throw new Error(`No files in directory: ${dirPath}`);
        }
        return path.join(dirPath, file);
    }

    private async newIdentity(): Promise<{ mspId: string; credentials: Buffer }> {
        const certPath = await this.getFirstDirFileName(this.certDirectoryPath);
        const credentials = await fs.readFile(certPath);
        return { mspId: this.mspId, credentials };
    }

    private async newSigner(): Promise<Signer> {
        const keyPath = await this.getFirstDirFileName(this.keyDirectoryPath);
        const privateKeyPem = await fs.readFile(keyPath);
        const privateKey = crypto.createPrivateKey(privateKeyPem);
        return signers.newPrivateKeySigner(privateKey);
    }

    public async getUser(contract: Contract, address: string): Promise<void> {
        console.log('\n--> Submit Transaction: GetUser');
        const res = await contract.submitTransaction("GetUser", address);
        const jsonString = this.utf8Decoder.decode(res);
        const jsonObject = JSON.parse(jsonString);
        console.log(jsonObject);
    }

    public async evaluateTransaction(functionName: string, ...args: Array<string | Uint8Array>): Promise<any> {
      this.displayInputParameters();
      const client = await this.newGrpcConnection();
      const gateway = connect({
          client,
          identity: await this.newIdentity(),
          signer: await this.newSigner(),
          hash: hash.sha256,
          evaluateOptions: () => ({ deadline: Date.now() + 5000 }),  // 5 seconds
          endorseOptions: () => ({ deadline: Date.now() + 15000 }), // 15 seconds
          submitOptions: () => ({ deadline: Date.now() + 5000 }),  // 5 seconds
          commitStatusOptions: () => ({ deadline: Date.now() + 60000 })  // 1 minute
      });

      try {
          console.log("network connection...");
          const network = gateway.getNetwork(this.channelName);
          console.log("network connected!");
          const contract = network.getContract(this.chaincodeName);
          console.log(contract.getChaincodeName());
          const res = await contract.evaluateTransaction(functionName, ...args);
          const jsonString = this.utf8Decoder.decode(res);
          const jsonObject = JSON.parse(jsonString);
          return jsonObject;
        } finally {
          gateway.close();
          client.close();
      }
    }

    public async submitTransaction(functionName: string, ...args: Array<string | Uint8Array>): Promise<any> {
      this.displayInputParameters();
      const client = await this.newGrpcConnection();
      const gateway = connect({
          client,
          identity: await this.newIdentity(),
          signer: await this.newSigner(),
          hash: hash.sha256,
          evaluateOptions: () => ({ deadline: Date.now() + 5000 }),  // 5 seconds
          endorseOptions: () => ({ deadline: Date.now() + 15000 }), // 15 seconds
          submitOptions: () => ({ deadline: Date.now() + 5000 }),  // 5 seconds
          commitStatusOptions: () => ({ deadline: Date.now() + 60000 })  // 1 minute
      });

      try {
          console.log("network connection...");
          const network = gateway.getNetwork(this.channelName);
          console.log("network connected!");
          const contract = network.getContract(this.chaincodeName);
          console.log(contract.getChaincodeName());
          const res = await contract.submitTransaction(functionName, ...args);
          const jsonString = this.utf8Decoder.decode(res);
          const jsonObject = JSON.parse(jsonString);
          return jsonObject;
        } finally {
          gateway.close();
          client.close();
      }
    }

    public displayInputParameters(): void {
        console.log(`channelName:       ${this.channelName}`);
        console.log(`chaincodeName:     ${this.chaincodeName}`);
        console.log(`mspId:             ${this.mspId}`);
        console.log(`cryptoPath:        ${this.cryptoPath}`);
        console.log(`keyDirectoryPath:  ${this.keyDirectoryPath}`);
        console.log(`certDirectoryPath: ${this.certDirectoryPath}`);
        console.log(`tlsCertPath:       ${this.tlsCertPath}`);
        console.log(`peerEndpoint:      ${this.peerEndpoint}`);
        console.log(`peerHostAlias:     ${this.peerHostAlias}`);
    }
}
