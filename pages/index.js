import { BigNumber, Contract, providers, utils } from "ethers";
import Head from "next/head";
import React, { useEffect, useRef, useState } from "react";
import Web3Modal from 'web3modal';
import {
  NFT_CONTRACT_ABI,
  NFT_CONTRACT_ADDRESS,
  TOKEN_CONTRACT_ABI,
  TOKEN_CONTRACT_ADDRESS,
} from '../constants';
import styles from '../styles/Home.module.css';

export default function Home() {
  //create a bignumber 0
  const zero = BigNumber.from(0);
  //walletConnected keeps track of whether the users wallet is connected or not
  const [walletConnected, setWalletConnected] = useState(false);
  //loading eh mudado para true - esperando a transacao ser minerada
  const [loading, setLoading] = useState(false);
  //tokenstoBeClaimed acompanha o numero de tokens à serem reinvindicados
  //baseado no NFT CryptoDev
  const [tokensToBeClaimed, setTokensToBeClaimed] = useState(zero);
  //balanceOfCryptoDevTokens rastreia o numero de CryptoDev recebidos por um endereco
  const [balanceOfCryptoDevTokens, setBalanceOfCryptoDevTokens] = useState(zero);

  //quantidade de tokens que o usuario quer mintar
  const [tokenAmount, setTokenAmount] = useState(zero);
  //tokenminted eh a qtdade de token que foram mintadas ate o momento
  const [tokensMinted, setTokensMinted] = useState(zero);
  //isOwner pega o dono do contrato pela assinatura do contrato
  const [isOwner, setIsOwner] = useState(false);
  //Cria uma referencia para o web3modal (usado para conectar MetaMask)
  const web3ModalRef = useRef();

  /*
    getTokensToBeClaimed(): checa o balanco de tokens que pode ser reinvindicados pelo usuario
  */
  const getTokensToBeClaimed = async () => {
    try {
      //pega o provider do web3modal, que neste caso eh o MetaMask
      //Nao precisa de signer aqui, pois estamos apenas lendo um estado da blockchain
      const provider = await getProviderOrSigner();
      //Cria um instancia do NFT Contract
      const nftContract = new Contract(NFT_CONTRACT_ADDRESS, NFT_CONTRACT_ABI, provider);
      const tokenContract = new Contract(TOKEN_CONTRACT_ADDRESS, TOKEN_CONTRACT_ABI, provider);
      //iremos pegar o assinante para extrair o endereco da conta Metamask conectada
      const signer = await getProviderOrSigner(true);
      //chama o balanco do endereco para pegar o numero de holders
      const address = await signer.getAddress();
      // call the balanceOf from the NFT contract to get the number of NFT's held by the user
      const balance = await nftContract.balanceOf(address);
      //o saldo e um BigNumber e iremos comparar isto com BigNumber zero
      if(balance === zero) {
        setTokensToBeClaimed(zero);
      } else {
        //qtidade mantem no track o numero de tokens nao reinvindicadas
        var amount = 0;
        //Para todas NFTs - checar se o token ja foi reinvindicado
        //apenas incrementar amount se os tokens nao foram reinvindicados
        //para um token (para um dado tokenID)
        for (var i = 0; i < balance; i++) {
          const tokenId = await nftContract.tokenOfOwnerByIndex(address, i);
          const claimed = await tokenContract.tokenIdsClaimed(tokenId);
          if (!claimed) {
            amount++
          }
        }
        //tokensToBeClaimed sao inicializados como BigNumber, entao nos podemos converter
        //uma qtidade para bigNumber e entao e config um valor
        setTokensToBeClaimed(BigNumber.from(amount));
      };
    } catch (err) {
      console.error(err);
      setTokensToBeClaimed(zero);
    }
  };
  /*
    getBalanceOfCryptoDevTokens: chega o saldo do Crypto Dev Tokens - FALTA fazer
  */
  const getBalanceOfCryptoDevTokens = async () => {
    try {
      //Pega o provider do web3modal que neste caso eh o Metamask
      //nao precisa de Signer, pois estamos lendo apenas o estado da rede
      const provider = await getProviderOrSigner();
      //cria uma instancia do contrato do token
      const tokenContract = new Contract(TOKEN_CONTRACT_ADDRESS, TOKEN_CONTRACT_ABI, provider);
      //nos iremos pegar o assinante e extrair o endereco conectado atualmente
      const signer = await getProviderOrSigner(true);
      //pega o endereco associado ao assinante que esta conectado ao metamask
      const address = await signer.getAddress();
      //chama a funcao balanceOf do token do contrato para pegar o numero de tokens possuido pelo usuario
      const balance = await tokenContract.balanceOf(address);
      //balance eh um bigNumber, entao nos nao precisamos converter antes
      setBalanceOfCryptoDevTokens(balance);
    } catch (err) {
      console.error(err);
      setBalanceOfCryptoDevTokens(zero);
    }
  };

  //mintCryptoDevToken: mints 'amount' number of tokens to given address
  const mintCryptoDevToken = async (amount) => {
    try {
      //precisamos de um Signer pois estaremos escrevendo uma transacao
      //criando um instancia do contrato
      const signer = await getProviderOrSigner(true);
      //cria uma instancia do contrato
      const tokenContract = new Contract(TOKEN_CONTRACT_ADDRESS, TOKEN_CONTRACT_ABI, signer);
      //Cada token custa 0.001 ether. O valor precisa ser 0.001 * amount
      const value = 0.001 * amount;
      const tx = await tokenContract.mint(amount, {
        //valor significa o custo de um cryptodev token
        //nos vamos arrumar o '0.001' string para ether usando utils libraby do ethers.js
        value: utils.parseEther(value.toString()),
      });
      setLoading(true);
      //aguardar a transacao ser minerada
      await tx.wait();
      setLoading(false);
      window.alert("Sucessfully minted Crypto Dev Tokens");
      await getBalanceOfCryptoDevTokens();
      await getTotalTokensMinted();
      await getTokensToBeClaimed();
    } catch (err) {
      console.error(err);  
    }
  };
  /**
  * claimCryptoDevTokens: Auxilia usuarios no reinvindicacao dos CryptoTokensDev
  */
  const claimCryptoDevTokens = async () => {
    try {
      // Precisa de signer pois realiza escrita no estado
      const signer = await getProviderOrSigner(true);
      //cria uma instancia de tokenContract
      const tokenContract = new Contract(
        TOKEN_CONTRACT_ADDRESS,
        TOKEN_CONTRACT_ABI,
        signer
      );
      const tx = await tokenContract.claim();
      setLoading(true);
      //aguarda a transacao ser minerada
      await tx.wait();
      setLoading(false);
      window.alert("Sucessfully claimed Crypto Dev Tokens");
      await getBalanceOfCryptoDevTokens();
      await getTotalTokensMinted();
      await getTokensToBeClaimed();
    } catch (err) {
      console.error(err);
    }
  };

  /**getTotalTokensMinted: retorna quantos tokens foram mintados ate o momento */
  const getTotalTokensMinted = async () => {
    try {
      // retorna o provedor da web3Modal, que no nosso caso e o metamask
      //nao precisa the Signer, pois estamos apenas lendo o blockchain
      const provider = await getProviderOrSigner();
      //cria uma instancia de token contract
      const tokenContract = new Contract(
        TOKEN_CONTRACT_ADDRESS,
        TOKEN_CONTRACT_ABI,
        provider
      );
      // puxa todos tokens que foram mintados
      const _tokenMinted = await tokenContract.totalSupply();
      setTokensMinted(_tokenMinted);
    } catch(err) {
      console.error(err);
    }
  };

  /**getOwner: retorna o dono do contrato */
  const getOwner = async () => {
    try {
      const provider = await getProviderOrSigner();
      const tokenContract = new Contract(TOKEN_CONTRACT_ADDRESS, TOKEN_CONTRACT_ABI, provider);
      //chama o dono do contrato 
      const _owner = await tokenContract.owner();
      // iremos retornar o signer para extrair o endereco atualment conectado na conta Metamask
      const signer = await getProviderOrSigner(true);
      // retorna o endereco associado ao signer que esta conectado com a metamask
      const address = await signer.getAddress();
      if (address.toLowerCase() === _owner.toLowerCase()) {
        setIsOwner(true);
      }
    } catch(err) {
      console.error(err.message);
    }
  };

  /**withdrawCoins: saca ether e tokens chamando a funcao withdraw no contrato */
  const withdrawCoins = async () => {
    try {
      const signer = await getProviderOrSigner(true);
      const tokenContract = new Contract(
        TOKEN_CONTRACT_ADDRESS,
        TOKEN_CONTRACT_ABI,
        signer
      );

      const tx = await tokenContract.withdraw();
      setLoading(true);
      await tx.wait();
      setLoading(false);
      await getOwner();
    } catch (err) {
      console.error(err);
    }
  }

  /**
   * Retorna um provider ou signer representando o Ethereum RPC com ou sem caracteristicas
   * assinatura atreladas ao metamask
   * 
   * provider e necessario para interacao do contrato - lendo transacoes, lendo balancos
   * 
   * signer e um tipo especial de provider capaz de escrever na blockchain
   * 
   * param needSigner - verdade se ele for signer
   */
  const getProviderOrSigner = async(needSigner = false) => {
    //connect to metamask
    const provider = await web3ModalRef.current.connect();
    const web3Provider = new providers.Web3Provider(provider);

    //se o usuario nao conectou com a rede rinkeby, deixa ele saber e retorna um erro
    const { chainId } = await web3Provider.getNetwork();
    if ( chainId !== 4 ) {
      window.alert("Change the network to Rinkeby");
      throw new Error("Change network to Rinkeby");
    }

    if(needSigner) {
      const signer = web3Provider.getSigner();
      return signer;
    }
    return web3Provider;
  };

  /**
   * connectWallet: connects the metamask wallet
   */
  const connectWallet = async() => {
    try {
      await getProviderOrSigner();
      setWalletConnected(true);
    } catch (err) {
      console.error(err);
    }
  };

  /**
   * useEffects sao usados para o react mudar o estado do site
   * o array no final da chamada da funcao representa o estado de mudancas 
   * neste caso, sempre que walletConected mudar esse efeito sera mudado
   */
  useEffect(() => {
    //se a carteira não esta conectada, cria uma nova instancia do web3modal
    if(!walletConnected) {
      web3ModalRef.current = new Web3Modal({
        network: "rinkeby",
        providerOptions: {},
        disableInjectedProvider: false,
      });
      connectWallet();
      getTotalTokensMinted();
      getBalanceOfCryptoDevTokens();
      getTokensToBeClaimed();
      //withdrawCoins();
    }
  }, [walletConnected]);

  /*
    renderButton: Returns a button based on the state of the dapp
  */
  const renderButton = () => {
    // If we are currently waiting for something, return a loading button
    if (loading) {
      return (
        <div>
          <button className={styles.button}>Loading...</button>
        </div>
      );
    }
    // if owner is connected, withdrawCoins() is called
    if (walletConnected && isOwner) {
      return (
        <div>
          <button className={styles.button1} onClick={withdrawCoins}>
            Withdraw Coins
          </button>
        </div>
      );
    }
    // If tokens to be claimed are greater than 0, Return a claim button
    if (tokensToBeClaimed > 0) {
      return (
        <div>
          <div className={styles.description}>
            {tokensToBeClaimed * 10} Tokens can be claimed!
          </div>
          <button className={styles.button} onClick={claimCryptoDevTokens}>
            Claim Tokens
          </button>
        </div>
      );
    }
    // If user doesn't have any tokens to claim, show the mint button
    return (
      <div style={{ display: "flex-col" }}>
        <div>
          <input
            type="number"
            placeholder="Amount of Tokens"
            // BigNumber.from converts the `e.target.value` to a BigNumber
            onChange={(e) => setTokenAmount(BigNumber.from(e.target.value))}
            className={styles.input}
          />
        </div>

        <button
          className={styles.button}
          disabled={!(tokenAmount > 0)}
          onClick={() => mintCryptoDevToken(tokenAmount)}
        >
          Mint Tokens
        </button>
      </div>
    );
  };

  return (
    <div>
      <Head>
        <title>Crypto Devs</title>
        <meta name="description" content="ICO-Dapp" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className={styles.main}>
        <div>
          <h1 className={styles.title}>Welcome to Crypto Devs ICO!</h1>
          <div className={styles.description}>
            You can claim or mint Crypto Dev tokens here
          </div>
          {walletConnected ? (
            <div>
              <div className={styles.description}>
                {/* Format Ether helps us in converting a BigNumber to string */}
                You have minted {utils.formatEther(balanceOfCryptoDevTokens)} Crypto
                Dev Tokens
              </div>
              <div className={styles.description}>
                {/* Format Ether helps us in converting a BigNumber to string */}
                Overall {utils.formatEther(tokensMinted)}/10000 have been minted!!!
              </div>
              {renderButton()}
            </div>
          ) : (
            <button onClick={connectWallet} className={styles.button}>
              Connect your wallet
            </button>
          )}
        </div>
        <div>
          <img className={styles.image} src="./0.svg" />
        </div>
      </div>

      <footer className={styles.footer}>
        Made with &#10084; by Crypto Devs
      </footer>
    </div>
  );
}