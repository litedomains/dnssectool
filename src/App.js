import React, { Component } from 'react'
import ENS from 'ethereum-ens';
// const DNSRegistrarJS = require('@ensdomains/dnsregistrar');
const DNSRegistrarJS = require('dnsregistrar');
import Promise from 'promise';

import getWeb3 from './utils/getWeb3'

import './css/oswald.css'
import './css/open-sans.css'
import './css/pure-min.css'
import './App.css'

class App extends Component {
  constructor(props) {
    super(props)

    this.state = {
      domain: null,
      network: null,
      owner:null,
      web3: null,
      accounts:[],
      proofs:[],
      claim: null,
      dnsFound:false,
      provenAddress:false
    }

    this.handleChange = this.handleChange.bind(this);
    this.handleLookup = this.handleLookup.bind(this);
    this.handleSubmitProof = this.handleSubmitProof.bind(this);
  }

  componentWillMount() {
    // Get network provider and web3 instance.
    // See utils/getWeb3 for more info.

    getWeb3
    .then(results => {
      this.setState({
        web3: results.web3
      })
      this.instantiateNetwork();
    })
    .catch(() => {
      console.log('Error finding web3.')
    })
  }

  handleChange(event) {
    this.setState({
      domain: event.target.value,
      dnsFound:false,
      proofs:[],
      ensAddress:'0x0',
      owner:null
    });
  }

  handleLookup(event) {
    this.instantiateContract();
    event.preventDefault();
  }

  handleSubmitProof(event) {
    var self = this;
    this.state.claim.submit({ from: this.state.accounts[0], gas:3000000 }).then((trx)=>{
      self.instantiateContract();
    })
    event.preventDefault();
  }

  instantiateContract(){
    const contract = require('truffle-contract')
    var registrarjs;
    var ensContract;
    var ens;
    var claim;

    var provider = this.state.web3.currentProvider;
    ens = new ENS(provider);
    let tld = this.state.domain.split('.').reverse()[0];
    return ens.owner(tld).then((owner)=>{
      console.log('owner', owner);
      registrarjs = new DNSRegistrarJS(provider, owner);
      console.log('this.state.domain', this.state.domain);
      return registrarjs.claim(this.state.domain);
    }).then((_claim)=>{
      console.log('claim',_claim);
      claim = _claim;
      this.setState({claim:claim, dnsFound:claim.found || claim.nsec});
      let text ='has no ETH address set';
      if(claim.found){
        text = `has TXT record with a=` + claim.getOwner();
      }
      this.setState({ proofs: [], owner: text });

      return Promise.all(claim.result.proofs.map((proof) => claim.oracle.knownProof(proof))).then((provens)=>{
         return claim.result.proofs.map((proof, i) => {

          var toProve = this.state.web3.sha3(proof.rrdata.toString('hex'), {encoding:"hex"}).slice(0,42)
          let matched;
          if(toProve == provens[i]){
            matched = "??? ";
          }else{
            matched = "???";
          }
          return {
            index: i+1,
            name: proof.name,
            type: proof.type,
            proof: provens[i],
            toProve:toProve,
            matched:matched
          };
         })
      });
    }).then((proofs) =>{
      this.setState({
          proofs: proofs
      });
      // This should also work (but not working for some reason now.
      // return ens.resolver(this.state.domain).addr();
      return ens.owner(this.state.domain);
    }).then((ensResult)=>{
      this.setState({ensAddress:ensResult});
    }).catch((e)=>{
      // Do now show error when ENS name is not found
      console.log('state', this.state)
      console.log('error', e)
    })
  }

  instantiateNetwork() {
    /*
     * SMART CONTRACT EXAMPLE
     *
     * Normally these functions would be called in the context of a
     * state management library, but for convenience I've placed them here.
     */

    var network = 'network not supported';

    this.state.web3.eth.getAccounts((error, accounts) => {
      this.setState({accounts:accounts});
      this.state.web3.version.getNetwork((err, netId) =>{
        console.log('getNetwork', err, netId)
        if(err){
          console.log('error', err)
        }else{
          switch (netId) {
            case "1":
              network = 'mainnet';
              break
            case "3":
              network = 'ropsten';
              break
            default:
              console.log('This is an unknown network.')
          }
          console.log('network', network)
          this.setState({ network:network})
        }
      })
    })
  }

  render() {
    if(this.state.domain){
      var dnsEntry = ('_ens.' + this.state.domain)
    }
    if(this.state.dnsFound){
      var submitProofForm = (
        <form onSubmit={this.handleSubmitProof}>
          <input type="submit" value="Submit the proof" />
        </form>
      )
    }

    var navStyle = {
      background:'#009DFF'
    }

    return (
      <div className="App">
        <nav style={navStyle} className="navbar pure-menu pure-menu-horizontal">
            <a href="#" className="pure-menu-heading pure-menu-link">DNS name claim tool</a>
            <label>{this.state.network}</label>
        </nav>

        <main className="container">

          <div className="pure-g">
            <div className="pure-u-1-1">
              <h3>Domain</h3>
              <form onSubmit={this.handleLookup}>
              <input type="text" value={this.state.domain} onChange={this.handleChange} required />
              <input type="submit" value="Lookup" />
              <h3>On DNS</h3>
              <p>
                <a href={`http://dnsviz.net/d/_ens.${this.state.domain}/dnssec`} target="_blank" >
                  {dnsEntry}
                </a> {this.state.owner}</p>
              </form>
              <h3>On DNSSEC Oracle</h3>
              <table>
                <tr>
                  <th>#</th>
                  <th>name</th>
                  <th>type</th> 
                  <th>matched?</th>
                </tr>
                {
                  this.state.proofs.sort((a,b)=>{return a.index - b.index}).map((proof, i) => {
                    return (
                      <tr>
                        <td>{proof.index}</td>
                        <td>{proof.name}</td>
                        <td>{proof.type}</td>
                        <td style={{textAlign:'center'}}>
                        <div className="tooltip">{proof.matched}
                          <span className="tooltiptext">
                            DNS proof is {proof.toProve} while DNSSEC Oracle has {proof.proof}
                          </span>
                        </div>
                        </td>
                      </tr>
                    )
                  })
                }
              </table>
              <h3>On ENS</h3>
              <p>
                The ENS Ethereum Address for this name is {this.state.ensAddress}
              </p>
              {submitProofForm}
            </div>
          </div>
        </main>
      </div>
    );
  }
}

export default App
