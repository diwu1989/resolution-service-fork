import supertest from 'supertest';
import { api } from '../api';
import { expect } from 'chai';
import { ApiKey, CnsRegistryEvent, Domain, DomainsResolution } from '../models';
import { DomainTestHelper } from '../utils/testing/DomainTestHelper';
import { znsNamehash, eip137Namehash } from '../utils/namehash';
import { env } from '../env';
import { getConnection } from 'typeorm';
import { Blockchain } from '../types/common';
import { ETHContracts } from '../contracts';
import { describe } from 'mocha';
import { DomainAttributes } from './dto/Domains';

describe('DomainsController', () => {
  let testApiKey: ApiKey;

  beforeEach(async () => {
    testApiKey = await ApiKey.createApiKey('testing key');
  });

  describe('GET /domain/:domainName', () => {
    it('should return correct domain resolution for L2 domain on L1', async () => {
      const { domain } = await DomainTestHelper.createTestDomain({
        name: 'brad.crypto',
        node: '0x756e4e998dbffd803c21d23b06cd855cdc7a4b57706c95964a37e24b47c10fc9',
        ownerAddress: '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8',
        blockchain: Blockchain.ETH,
        networkId: 1337,
        registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
        resolution: {
          'crypto.ETH.address': '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8',
        },
        resolver: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
      });
      const resolution = domain.getResolution(Blockchain.MATIC, 1337);
      resolution.ownerAddress = '0x0000000000000000000000000000000000000000';
      resolution.resolver = '0xa9a6a3626993d487d2dbda3173cf58ca1a9d9e9f';
      resolution.registry = '0xa9a6a3626993d487d2dbda3173cf58ca1a9d9e9f';
      resolution.resolution = {};
      domain.setResolution(resolution);
      await domain.save();

      const res = await supertest(api)
        .get('/domains/brad.crypto')
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(res.status).eq(200);
      expect(res.body).containSubset({
        meta: {
          domain: 'brad.crypto',
          owner: '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8',
          resolver: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
          registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
          blockchain: 'ETH',
          networkId: 1337,
        },
        records: {
          'crypto.ETH.address': '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8',
        },
      });
    });

    it('should return correct domain resolution for L2 domain', async () => {
      const { domain } = await DomainTestHelper.createTestDomain({
        name: 'brad.crypto',
        node: '0x756e4e998dbffd803c21d23b06cd855cdc7a4b57706c95964a37e24b47c10fc9',
        ownerAddress: '0x0000000000000000000000000000000000000000',
        blockchain: Blockchain.ETH,
        networkId: 1337,
        registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
        resolution: {},
        resolver: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
      });
      const resolution = domain.getResolution(Blockchain.MATIC, 1337);
      resolution.ownerAddress = '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8';
      resolution.resolver = '0xa9a6a3626993d487d2dbda3173cf58ca1a9d9e9f';
      resolution.registry = '0xa9a6a3626993d487d2dbda3173cf58ca1a9d9e9f';
      resolution.resolution = {
        'crypto.ETH.address': '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8',
      };
      domain.setResolution(resolution);
      await domain.save();

      const res = await supertest(api)
        .get('/domains/brad.crypto')
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(res.status).eq(200);
      expect(res.body).containSubset({
        meta: {
          domain: 'brad.crypto',
          owner: '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8',
          resolver: '0xa9a6a3626993d487d2dbda3173cf58ca1a9d9e9f',
          registry: '0xa9a6a3626993d487d2dbda3173cf58ca1a9d9e9f',
          blockchain: 'MATIC',
          networkId: 1337,
        },
        records: {
          'crypto.ETH.address': '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8',
        },
      });
    });

    it('should return error for unauthorized query', async () => {
      const res = await supertest(api).get('/domains/brad.crypto').send();
      expect(res.status).eq(403);
      expect(res.body).containSubset({
        message: 'Please provide a valid API key.',
      });
    });

    it('should return non-minted domain', async () => {
      const res = await supertest(api)
        .get('/domains/unminted-long-domain.crypto')
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(res.body).containSubset({
        meta: {
          domain: 'unminted-long-domain.crypto',
          owner: null,
          resolver: null,
          registry: null,
          blockchain: null,
          networkId: null,
        },
        records: {},
      });
      expect(res.status).eq(200);
    });

    it('should return non-minted domain when used a wrong tld', async () => {
      const res = await supertest(api)
        .get('/domains/bobby.funnyrabbit')
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(res.status).eq(200);
      expect(res.body).containSubset({
        meta: {
          domain: 'bobby.funnyrabbit',
          owner: null,
          resolver: null,
          registry: null,
          blockchain: null,
          networkId: null,
        },
        records: {},
      });
    });

    it('should return correct domain resolution for domain in lowercase', async () => {
      await DomainTestHelper.createTestDomain({
        name: 'testdomainforcase.crypto',
        node: '0x08c2e9d2a30aa81623fcc758848d5556696868222fbc80a15ca46ec2fe2cba4f',
        ownerAddress: '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8',
        blockchain: Blockchain.ETH,
        networkId: 1337,
        registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
        resolution: {
          'crypto.ETH.address': '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8',
        },
        resolver: '0xb66DcE2DA6afAAa98F2013446dBCB0f4B0ab2842',
      });
      const res = await supertest(api)
        .get('/domains/TESTdomainforCase.crypto')
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(res.status).eq(200);
      expect(res.body).containSubset({
        meta: {
          domain: 'testdomainforcase.crypto',
          owner: '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8',
          resolver: '0xb66DcE2DA6afAAa98F2013446dBCB0f4B0ab2842',
          registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
          blockchain: 'ETH',
          networkId: 1337,
        },
        records: {
          'crypto.ETH.address': '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8',
        },
      });
    });

    it('should return correct registry for all locations domains', async () => {
      const { domain: znsDomain } = await DomainTestHelper.createTestDomain({
        blockchain: Blockchain.ZIL,
        networkId: env.APPLICATION.ZILLIQA.NETWORK_ID,
        name: 'test.zil',
        node: znsNamehash('test.zil'),
        registry: env.APPLICATION.ZILLIQA.ZNS_REGISTRY_CONTRACT,
      });
      const { domain: cnsDomain } = await DomainTestHelper.createTestDomain();
      const { domain: unsDomain } = await DomainTestHelper.createTestDomain({
        name: 'test.nft',
        node: eip137Namehash('test.nft'),
        registry: ETHContracts.UNSRegistry.address,
        blockchain: Blockchain.ETH,
        networkId: env.APPLICATION.ETHEREUM.NETWORK_ID,
      });

      const znsResult = await supertest(api)
        .get(`/domains/${znsDomain.name}`)
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(znsResult.status).eq(200);
      expect(znsResult.body.meta.registry).eq(
        env.APPLICATION.ZILLIQA.ZNS_REGISTRY_CONTRACT,
      );

      const cnsResult = await supertest(api)
        .get(`/domains/${cnsDomain.name}`)
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(cnsResult.status).eq(200);
      expect(cnsResult.body.meta.registry).eq(ETHContracts.CNSRegistry.address);

      const unsResult = await supertest(api)
        .get(`/domains/${unsDomain.name}`)
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(unsResult.status).eq(200);
      expect(unsResult.body.meta.registry).eq(ETHContracts.UNSRegistry.address);
    });

    it('should return non-minted domain ending on .zil', async () => {
      const res = await supertest(api)
        .get('/domains/notreal134522.zil')
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(res.status).eq(200);
      expect(res.body).containSubset({
        meta: {
          domain: 'notreal134522.zil',
          owner: null,
          resolver: null,
          registry: null,
          blockchain: null,
          networkId: null,
        },
        records: {},
      });
    });

    it('should return minted domain ending on .zil', async () => {
      await DomainTestHelper.createTestDomain({
        blockchain: Blockchain.ZIL,
        networkId: env.APPLICATION.ZILLIQA.NETWORK_ID,
        name: 'sometestforzil.zil',
        ownerAddress: '0xcea21f5a6afc11b3a4ef82e986d63b8b050b6910',
        resolver: '0x34bbdee3404138430c76c2d1b2d4a2d223a896df',
        registry: '0x9611c53be6d1b32058b2747bdececed7e1216793',
        node: '0x8052ef7b6b4eee4bc0d7014f0e216db6270bf0055bcd3582368601f2de5e60f0',
        resolution: {},
      });
      const res = await supertest(api)
        .get('/domains/sometestforzil.zil')
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(res.status).eq(200);
      expect(res.body).containSubset({
        meta: {
          domain: 'sometestforzil.zil',
          owner: '0xcea21f5a6afc11b3a4ef82e986d63b8b050b6910',
          resolver: '0x34bbdee3404138430c76c2d1b2d4a2d223a896df',
          registry: '0x9611c53be6d1b32058b2747bdececed7e1216793',
          blockchain: 'ZIL',
          networkId: 333,
        },
        records: {},
      });
    });

    it('should return correct domain resolution for minted .crypto domain', async () => {
      await DomainTestHelper.createTestDomain({
        name: 'brad.crypto',
        ownerAddress: '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8',
        node: '0x756e4e998dbffd803c21d23b06cd855cdc7a4b57706c95964a37e24b47c10fc9',
        registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
        resolution: {
          'gundb.username.value':
            '0x8912623832e174f2eb1f59cc3b587444d619376ad5bf10070e937e0dc22b9ffb2e3ae059e6ebf729f87746b2f71e5d88ec99c1fb3c7c49b8617e2520d474c48e1c',
          'ipfs.html.value': 'QmdyBw5oTgCtTLQ18PbDvPL8iaLoEPhSyzD91q9XmgmAjb',
          'ipfs.redirect_domain.value':
            'https://abbfe6z95qov3d40hf6j30g7auo7afhp.mypinata.cloud/ipfs/Qme54oEzRkgooJbCDr78vzKAWcv6DDEZqRhhDyDtzgrZP6',
          'crypto.ETH.address': '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8',
          'gundb.public_key.value':
            'pqeBHabDQdCHhbdivgNEc74QO-x8CPGXq4PKWgfIzhY.7WJR5cZFuSyh1bFwx0GWzjmrim0T5Y6Bp0SSK0im3nI',
          'crypto.BTC.address': 'bc1q359khn0phg58xgezyqsuuaha28zkwx047c0c3y',
        },
        resolver: '0xb66DcE2DA6afAAa98F2013446dBCB0f4B0ab2842',
      });

      const res = await supertest(api)
        .get('/domains/brad.crypto')
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();

      expect(res.status).eq(200);
      expect(res.body).containSubset({
        meta: {
          domain: 'brad.crypto',
          owner: '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8',
          resolver: '0xb66DcE2DA6afAAa98F2013446dBCB0f4B0ab2842',
          registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
          blockchain: 'ETH',
          networkId: 1337,
        },
        records: {
          'gundb.username.value':
            '0x8912623832e174f2eb1f59cc3b587444d619376ad5bf10070e937e0dc22b9ffb2e3ae059e6ebf729f87746b2f71e5d88ec99c1fb3c7c49b8617e2520d474c48e1c',
          'ipfs.html.value': 'QmdyBw5oTgCtTLQ18PbDvPL8iaLoEPhSyzD91q9XmgmAjb',
          'ipfs.redirect_domain.value':
            'https://abbfe6z95qov3d40hf6j30g7auo7afhp.mypinata.cloud/ipfs/Qme54oEzRkgooJbCDr78vzKAWcv6DDEZqRhhDyDtzgrZP6',
          'crypto.ETH.address': '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8',
          'gundb.public_key.value':
            'pqeBHabDQdCHhbdivgNEc74QO-x8CPGXq4PKWgfIzhY.7WJR5cZFuSyh1bFwx0GWzjmrim0T5Y6Bp0SSK0im3nI',
          'crypto.BTC.address': 'bc1q359khn0phg58xgezyqsuuaha28zkwx047c0c3y',
        },
      });
    });
  });

  it('should return correct domain resolution for L2 domain', async () => {
    const { domain } = await DomainTestHelper.createTestDomain({
      name: 'brad.crypto',
      node: '0x756e4e998dbffd803c21d23b06cd855cdc7a4b57706c95964a37e24b47c10fc9',
      ownerAddress: '0x0000000000000000000000000000000000000000',
      blockchain: Blockchain.ETH,
      networkId: 1337,
      registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
      resolution: {},
      resolver: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
    });
    const resolution = domain.getResolution(Blockchain.MATIC, 1337);
    resolution.ownerAddress = '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8';
    resolution.resolver = '0xa9a6a3626993d487d2dbda3173cf58ca1a9d9e9f';
    resolution.registry = '0xa9a6a3626993d487d2dbda3173cf58ca1a9d9e9f';
    resolution.resolution = {
      'crypto.ETH.address': '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8',
    };
    domain.setResolution(resolution);
    await domain.save();

    const res = await supertest(api)
      .get('/domains/brad.crypto')
      .auth(testApiKey.apiKey, { type: 'bearer' })
      .send();
    expect(res.status).eq(200);
    expect(res.body).containSubset({
      meta: {
        domain: 'brad.crypto',
        owner: '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8',
        resolver: '0xa9a6a3626993d487d2dbda3173cf58ca1a9d9e9f',
        registry: '0xa9a6a3626993d487d2dbda3173cf58ca1a9d9e9f',
        blockchain: 'MATIC',
        networkId: 1337,
      },
      records: {
        'crypto.ETH.address': '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8',
      },
    });
  });

  it('should return correct domain resolution for L2 domain on L1', async () => {
    const { domain } = await DomainTestHelper.createTestDomain({
      name: 'brad.crypto',
      node: '0x756e4e998dbffd803c21d23b06cd855cdc7a4b57706c95964a37e24b47c10fc9',
      ownerAddress: '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8',
      blockchain: Blockchain.ETH,
      networkId: 1337,
      registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
      resolution: {
        'crypto.ETH.address': '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8',
      },
      resolver: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
    });
    const resolution = await domain.getResolution(Blockchain.MATIC, 1337);
    resolution.ownerAddress = '0x0000000000000000000000000000000000000000';
    resolution.resolver = '0xa9a6a3626993d487d2dbda3173cf58ca1a9d9e9f';
    resolution.registry = '0xa9a6a3626993d487d2dbda3173cf58ca1a9d9e9f';
    resolution.resolution = {};
    domain.setResolution(resolution);
    await domain.save();

    const res = await supertest(api)
      .get('/domains/brad.crypto')
      .auth(testApiKey.apiKey, { type: 'bearer' })
      .send();
    expect(res.status).eq(200);
    expect(res.body).containSubset({
      meta: {
        domain: 'brad.crypto',
        owner: '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8',
        resolver: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
        registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
        blockchain: 'ETH',
        networkId: 1337,
      },
      records: {
        'crypto.ETH.address': '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8',
      },
    });
  });
  describe('GET /domains', () => {
    it('should return error for unauthorized query', async () => {
      const res = await supertest(api)
        .get('/domains?owners[]=0xC47Ef814093eCefe330604D9E81e3940ae033c9a')
        .send();
      expect(res.status).eq(403);
      expect(res.body).containSubset({
        message: 'Please provide a valid API key.',
      });
    });

    it('should return empty response', async () => {
      const res = await supertest(api)
        .get('/domains?owners[]=0xC47Ef814093eCefe330604D9E81e3940ae033c9a')
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(res.body).containSubset({
        data: [],
      });
      expect(res.status).eq(200);
    });
    it('should return true for hasMore', async () => {
      const { domain: testDomain } = await DomainTestHelper.createTestDomain({
        name: 'test1.crypto',
        node: '0x99cc72a0f40d092d1b8b3fa8f2da5b7c0c6a9726679112e3827173f8b2460502',
        ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
        registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
      });
      await DomainTestHelper.createTestDomain({
        name: 'test2.crypto',
        node: '0xb899b9e12897c7cea4e24fc4815055b9777ad145507c5e0e1a4edac00b43cf0a',
        ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
        registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
      });

      const res = await supertest(api)
        .get(
          '/domains?owners[]=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2&perPage=1',
        )
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(res.body).to.deep.equal({
        data: [
          {
            id: testDomain.name,
            attributes: {
              meta: {
                domain: testDomain.name,
                blockchain: 'ETH',
                networkId: 1337,
                owner: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
                registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
                resolver: '0xb66DcE2DA6afAAa98F2013446dBCB0f4B0ab2842',
              },
              records: {},
            },
          },
        ],
        meta: {
          hasMore: true,
          nextStartingAfter: testDomain.id?.toString(),
          sortBy: 'id',
          sortDirection: 'ASC',
          perPage: 1,
        },
      });
      expect(res.status).eq(200);
    });
    it('should return false for hasMore', async () => {
      const { domain: testDomain } = await DomainTestHelper.createTestDomain({
        name: 'test1.crypto',
        node: '0x99cc72a0f40d092d1b8b3fa8f2da5b7c0c6a9726679112e3827173f8b2460502',
        ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
        registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
      });

      const res = await supertest(api)
        .get(
          '/domains?owners[]=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2&perPage=1',
        )
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(res.body).to.deep.equal({
        data: [
          {
            id: testDomain.name,
            attributes: {
              meta: {
                domain: testDomain.name,
                blockchain: 'ETH',
                networkId: 1337,
                owner: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
                registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
                resolver: '0xb66DcE2DA6afAAa98F2013446dBCB0f4B0ab2842',
              },
              records: {},
            },
          },
        ],
        meta: {
          hasMore: false,
          nextStartingAfter: testDomain.id?.toString(),
          sortBy: 'id',
          sortDirection: 'ASC',
          perPage: 1,
        },
      });
      expect(res.status).eq(200);
    });
    it('should return list of test domain', async () => {
      const { domain: testDomain, resolution } =
        await DomainTestHelper.createTestDomain({
          name: 'test1.crypto',
          node: '0x99cc72a0f40d092d1b8b3fa8f2da5b7c0c6a9726679112e3827173f8b2460502',
          ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
          registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
        });

      const res = await supertest(api)
        .get('/domains?owners[]=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2')
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(res.body).to.deep.equal({
        data: [
          {
            id: testDomain.name,
            attributes: {
              meta: {
                domain: testDomain.name,
                blockchain: resolution.blockchain,
                networkId: resolution.networkId,
                owner: resolution.ownerAddress,
                registry: resolution.registry,
                resolver: resolution.resolver,
              },
              records: {},
            },
          },
        ],
        meta: {
          hasMore: false,
          perPage: 100,
          nextStartingAfter: testDomain.id?.toString(),
          sortBy: 'id',
          sortDirection: 'ASC',
        },
      });
      expect(res.status).eq(200);
    });
    it('should lowercase ownerAddress', async () => {
      const { domain: testDomain, resolution } =
        await DomainTestHelper.createTestDomain({
          name: 'test.crypto',
          node: '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
          ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
          registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
        });

      const res = await supertest(api)
        .get(
          `/domains?owners[]=${'0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2'.toUpperCase()}`,
        )
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(res.body).to.deep.equal({
        data: [
          {
            id: testDomain.name,
            attributes: {
              meta: {
                domain: testDomain.name,
                blockchain: resolution.blockchain,
                networkId: resolution.networkId,
                owner: resolution.ownerAddress,
                registry: resolution.registry,
                resolver: resolution.resolver,
              },
              records: {},
            },
          },
        ],
        meta: {
          hasMore: false,
          sortBy: 'id',
          sortDirection: 'ASC',
          perPage: 100,
          nextStartingAfter: testDomain.id?.toString(),
        },
      });
      expect(res.status).eq(200);
    });
    it('should return list of test domains', async () => {
      const { domain: testDomainOne, resolution: resolutionOne } =
        await DomainTestHelper.createTestDomain({
          name: 'test.crypto',
          node: '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
          ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
          registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
        });
      const { domain: testDomainTwo, resolution: resolutionTwo } =
        await DomainTestHelper.createTestDomain({
          name: 'test1.crypto',
          node: '0x99cc72a0f40d092d1b8b3fa8f2da5b7c0c6a9726679112e3827173f8b2460502',
          ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
          registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
        });

      const res = await supertest(api)
        .get('/domains?owners=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2')
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(res.body.data).to.have.deep.members([
        {
          id: testDomainOne.name,
          attributes: {
            meta: {
              domain: testDomainOne.name,
              blockchain: resolutionOne.blockchain,
              networkId: resolutionOne.networkId,
              owner: resolutionOne.ownerAddress,
              registry: resolutionOne.registry,
              resolver: resolutionOne.resolver,
            },
            records: {},
          },
        },
        {
          id: testDomainTwo.name,
          attributes: {
            meta: {
              domain: testDomainTwo.name,
              blockchain: resolutionTwo.blockchain,
              networkId: resolutionTwo.networkId,
              owner: resolutionTwo.ownerAddress,
              registry: resolutionTwo.registry,
              resolver: resolutionTwo.resolver,
            },
            records: {},
          },
        },
      ]);
      expect(res.status).eq(200);
    });
    it('should return domains for multiple owners', async () => {
      const testDomains = await Promise.all([
        await DomainTestHelper.createTestDomain({
          name: 'test.crypto',
          node: '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
          ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
          registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
        }),
        await DomainTestHelper.createTestDomain({
          name: 'test1.crypto',
          node: '0x99cc72a0f40d092d1b8b3fa8f2da5b7c0c6a9726679112e3827173f8b2460502',
          ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
          registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
        }),
        await DomainTestHelper.createTestDomain({
          name: 'test3.crypto',
          node: '0xde3d1be3661eadd92290828d632e0dd25703b6008cd92d03f51be25795fe922d',
          ownerAddress: '0x111115e932a88b2e7d0130712b3aa9fb7c522222',
          registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
        }),
      ]);

      const expectedDomains = testDomains.map((d) => ({
        id: d.domain.name,
        attributes: {
          meta: {
            domain: d.domain.name,
            blockchain: d.resolution.blockchain,
            networkId: d.resolution.networkId,
            owner: d.resolution.ownerAddress,
            registry: d.resolution.registry,
            resolver: d.resolution.resolver,
          },
          records: {},
        },
      }));

      const res = await supertest(api)
        .get(
          '/domains?owners=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2&owners=0x111115e932a88b2e7d0130712b3aa9fb7c522222',
        )
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(res.body.data).to.have.deep.members(expectedDomains);
      expect(res.status).eq(200);
    });
    it('should return one domain perPage', async () => {
      const { domain: testDomainOne, resolution: resolutionOne } =
        await DomainTestHelper.createTestDomain({
          name: 'test.crypto',
          node: '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
          ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
          registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
        });
      await DomainTestHelper.createTestDomain({
        blockchain: Blockchain.ZIL,
        networkId: env.APPLICATION.ZILLIQA.NETWORK_ID,
        name: 'test1.zil',
        node: '0xc0cfff0bacee0844926d425ce027c3d05e09afaa285661aca11c5a97639ef001',
        ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
        registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
      });

      const res = await supertest(api)
        .get(
          '/domains?owners[]=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2&perPage=1',
        )
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(res.body).to.deep.equal({
        data: [
          {
            id: testDomainOne.name,
            attributes: {
              meta: {
                domain: testDomainOne.name,
                blockchain: resolutionOne.blockchain,
                networkId: resolutionOne.networkId,
                owner: resolutionOne.ownerAddress,
                registry: resolutionOne.registry,
                resolver: resolutionOne.resolver,
              },
              records: {},
            },
          },
        ],
        meta: {
          hasMore: true,
          sortBy: 'id',
          sortDirection: 'ASC',
          perPage: 1,
          nextStartingAfter: testDomainOne.id?.toString(),
        },
      });
      expect(res.status).eq(200);
    });
    it('should return single MATIC resolution for each domain with multiple resolutions', async () => {
      const { domain: domainOne } =
        await DomainTestHelper.createTestDomainWithMultipleResolutions(
          {
            name: 'test.crypto',
            node: '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
            ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
            registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
          },
          {
            name: 'test.crypto',
            node: '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
            ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
            registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
            resolution: {
              'crypto.ETH.address':
                '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
            },
            blockchain: Blockchain.MATIC,
            networkId: env.APPLICATION.POLYGON.NETWORK_ID,
          },
        );
      const { domain: domainTwo } =
        await DomainTestHelper.createTestDomainWithMultipleResolutions(
          {
            name: 'test2.crypto',
            node: '0xb899b9e12897c7cea4e24fc4815055b9777ad145507c5e0e1a4edac00b43cf0a',
            ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
            registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
          },
          {
            name: 'test2.crypto',
            node: '0xb899b9e12897c7cea4e24fc4815055b9777ad145507c5e0e1a4edac00b43cf0a',
            ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
            registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
            resolution: {
              'crypto.ETH.address':
                '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
            },
            blockchain: Blockchain.MATIC,
            networkId: env.APPLICATION.POLYGON.NETWORK_ID,
          },
        );
      const { domain: domainThree } =
        await DomainTestHelper.createTestDomainWithMultipleResolutions(
          {
            name: 'test3.crypto',
            node: '0xde3d1be3661eadd92290828d632e0dd25703b6008cd92d03f51be25795fe922d',
            ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
            registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
          },
          {
            name: 'test3.crypto',
            node: '0xde3d1be3661eadd92290828d632e0dd25703b6008cd92d03f51be25795fe922d',
            ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
            registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
            resolution: {
              'crypto.ETH.address':
                '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
            },
            blockchain: Blockchain.MATIC,
            networkId: env.APPLICATION.POLYGON.NETWORK_ID,
          },
        );
      const { domain: domainFour } =
        await DomainTestHelper.createTestDomainWithMultipleResolutions(
          {
            name: 'test4.crypto',
            node: '0x36f2168288f23c788493ec57064e1e447342670aa096f834b862fed02439d202',
            ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
            registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
          },
          {
            name: 'test4.crypto',
            node: '0x36f2168288f23c788493ec57064e1e447342670aa096f834b862fed02439d202',
            ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
            registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
            resolution: {
              'crypto.ETH.address':
                '0x033dc48B5dB4CA62861643e9D2C411D9eb6D1975',
            },
            blockchain: Blockchain.MATIC,
            networkId: env.APPLICATION.POLYGON.NETWORK_ID,
          },
        );
      const res = await supertest(api)
        .get(`/domains?owners[]=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2`)
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(res.body).to.deep.equal({
        data: [
          {
            id: domainOne.name,
            attributes: {
              meta: {
                domain: domainOne.name,
                blockchain: 'MATIC',
                networkId: 1337,
                owner: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
                registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
                resolver: '0xb66DcE2DA6afAAa98F2013446dBCB0f4B0ab2842',
              },
              records: {
                'crypto.ETH.address':
                  '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
              },
            },
          },
          {
            id: domainTwo.name,
            attributes: {
              meta: {
                domain: domainTwo.name,
                blockchain: 'MATIC',
                networkId: 1337,
                owner: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
                registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
                resolver: '0xb66DcE2DA6afAAa98F2013446dBCB0f4B0ab2842',
              },
              records: {
                'crypto.ETH.address':
                  '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
              },
            },
          },
          {
            id: domainThree.name,
            attributes: {
              meta: {
                domain: domainThree.name,
                blockchain: 'MATIC',
                networkId: 1337,
                owner: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
                registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
                resolver: '0xb66DcE2DA6afAAa98F2013446dBCB0f4B0ab2842',
              },
              records: {
                'crypto.ETH.address':
                  '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
              },
            },
          },
          {
            id: domainFour.name,
            attributes: {
              meta: {
                domain: domainFour.name,
                blockchain: 'MATIC',
                networkId: 1337,
                owner: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
                registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
                resolver: '0xb66DcE2DA6afAAa98F2013446dBCB0f4B0ab2842',
              },
              records: {
                'crypto.ETH.address':
                  '0x033dc48B5dB4CA62861643e9D2C411D9eb6D1975',
              },
            },
          },
        ],
        meta: {
          hasMore: false,
          nextStartingAfter: domainFour.id?.toString(),
          perPage: 100,
          sortBy: 'id',
          sortDirection: 'ASC',
        },
      });
      expect(res.status).eq(200);
    });
    it('should return MATIC resolution for domain with multiple resolutions', async () => {
      const { domain } =
        await DomainTestHelper.createTestDomainWithMultipleResolutions(
          {
            name: 'test.crypto',
            node: '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
            ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
            registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
          },
          {
            name: 'test.crypto',
            node: '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
            ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
            registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
            resolution: {
              'crypto.ETH.address':
                '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
            },
            blockchain: Blockchain.MATIC,
            networkId: env.APPLICATION.POLYGON.NETWORK_ID,
          },
        );
      const res = await supertest(api)
        .get(`/domains?owners[]=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2`)
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(res.body).to.deep.equal({
        data: [
          {
            id: domain.name,
            attributes: {
              meta: {
                domain: domain.name,
                blockchain: 'MATIC',
                networkId: 1337,
                owner: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
                registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
                resolver: '0xb66DcE2DA6afAAa98F2013446dBCB0f4B0ab2842',
              },
              records: {
                'crypto.ETH.address':
                  '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
              },
            },
          },
        ],
        meta: {
          hasMore: false,
          nextStartingAfter: domain.id?.toString(),
          perPage: 100,
          sortBy: 'id',
          sortDirection: 'ASC',
        },
      });
      expect(res.status).eq(200);
    });

    it('filters domains list by tld', async () => {
      const { domain: testDomainOne, resolution: resolutionOne } =
        await DomainTestHelper.createTestDomain({
          name: 'test.crypto',
          node: '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
          ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
          registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
        });
      await DomainTestHelper.createTestDomain({
        blockchain: Blockchain.ZIL,
        networkId: env.APPLICATION.ZILLIQA.NETWORK_ID,
        name: 'test1.zil',
        node: '0xc0cfff0bacee0844926d425ce027c3d05e09afaa285661aca11c5a97639ef001',
        ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
        registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
      });
    });

    it('filters domains list by multiple tlds', async () => {
      const { domain: testDomainOne, resolution: resolutionOne } =
        await DomainTestHelper.createTestDomain({
          name: 'test.crypto',
          node: '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
          ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
          registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
        });
      const { domain: testDomainTwo, resolution: resolutionTwo } =
        await DomainTestHelper.createTestDomain({
          blockchain: Blockchain.ZIL,
          networkId: env.APPLICATION.ZILLIQA.NETWORK_ID,
          name: 'test1.zil',
          node: '0xc0cfff0bacee0844926d425ce027c3d05e09afaa285661aca11c5a97639ef001',
          ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
          registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
        });

      const res = await supertest(api)
        .get(
          '/domains?owners=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2&tlds=crypto',
        )
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(res.body).to.deep.equal({
        data: [
          {
            id: testDomainOne.name,
            attributes: {
              meta: {
                domain: testDomainOne.name,
                blockchain: resolutionOne.blockchain,
                networkId: resolutionOne.networkId,
                owner: resolutionOne.ownerAddress,
                registry: resolutionOne.registry,
                resolver: resolutionOne.resolver,
              },
              records: {},
            },
          },
        ],
        meta: {
          hasMore: false,
          nextStartingAfter: testDomainOne.id?.toString(),
          perPage: 100,
          sortBy: 'id',
          sortDirection: 'ASC',
        },
      });
      expect(res.status).eq(200);
    });

    it('should return no domain from empty startingAfter', async () => {
      const { domain } = await DomainTestHelper.createTestDomain({
        name: 'test.crypto',
        node: '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
        ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
        registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
      });
      const res = await supertest(api)
        .get(
          `/domains?owners[]=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2&startingAfter=${(
            (domain.id || 0) + 1
          ).toString()}`,
        )
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(res.body).to.deep.equal({
        data: [],
        meta: {
          hasMore: false,
          nextStartingAfter: ((domain.id || 0) + 1).toString(),
          perPage: 100,
          sortBy: 'id',
          sortDirection: 'ASC',
        },
      });
      expect(res.status).eq(200);
    });

    it('should return error on missing owners param', async () => {
      const res = await supertest(api)
        .get('/domains?awef[]=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2')
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(res.body).containSubset({
        errors: [
          {
            constraints: {
              arrayNotEmpty: 'owners should not be empty',
              isArray: 'owners must be an array',
              isNotEmpty: 'each value in owners should not be empty',
              isString: 'each value in owners must be a string',
            },
          },
        ],
      });
      expect(res.status).eq(400);
    });
  });

  describe('GET /domains/:domainName/transfers/latest', () => {
    type eventsTestData = { from: string; to: string }[];
    async function saveCnsEvents(
      tokenId: string,
      l1events: eventsTestData,
      l2events: eventsTestData,
    ) {
      for (let i = 0; i < l1events.length; i++) {
        const event = l1events[i];
        await new CnsRegistryEvent({
          contractAddress: '0xdead1dead1dead1dead1dead1dead1dead1dead1',
          type: 'Transfer',
          blockchain: 'ETH',
          networkId: 1,
          blockNumber: i,
          blockHash: `0x${i}`,
          logIndex: 1,
          returnValues: { tokenId: tokenId, from: event.from, to: event.to },
        }).save();
      }
      for (let i = 0; i < l2events.length; i++) {
        const event = l2events[i];
        await new CnsRegistryEvent({
          contractAddress: '0xdead2dead2dead2dead2dead2dead2dead2dead2',
          type: 'Transfer',
          blockchain: 'MATIC',
          networkId: 137,
          blockNumber: i + 1000,
          blockHash: `0x${i + 1000}`,
          logIndex: 1,
          returnValues: { tokenId: tokenId, from: event.from, to: event.to },
        }).save();
      }
    }

    it('should return latest transfers from MATIC and ETH networks', async () => {
      const { domain: testDomain } = await DomainTestHelper.createTestDomainL2(
        {
          name: 'kirill.dao',
          node: '0x06fd626e68ed0311d37c040c788137dc168124856fdb3b5ec37f54e98dd764ef',
        },
        {
          ownerAddress: '0xea674fdde714fd979de3edf0f56aa9716b898ec8',
          registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
        },
        {
          ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
          registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
        },
      );
      await saveCnsEvents(
        testDomain.node,
        [
          {
            from: '0x0000000000000000000000000000000000000000',
            to: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
          },
          {
            from: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
            to: '0xea674fdde714fd979de3edf0f56aa9716b898ec8',
          },
        ],
        [
          {
            from: '0x0000000000000000000000000000000000000000',
            to: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
          },
          {
            from: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
            to: '0xea674fdde714fd979de3edf0f56aa9716b898ec8',
          },
          {
            from: '0xea674fdde714fd979de3edf0f56aa9716b898ec8',
            to: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
          },
        ],
      );

      const res = await supertest(api)
        .get(`/domains/${testDomain.name}/transfers/latest`)
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();

      expect(res.status).eq(200);
      expect(res.body).to.deep.eq({
        data: [
          {
            domain: testDomain.name,
            from: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
            to: '0xea674fdde714fd979de3edf0f56aa9716b898ec8',
            blockNumber: 1,
            networkId: 1,
            blockchain: 'ETH',
          },
          {
            domain: testDomain.name,
            from: '0xea674fdde714fd979de3edf0f56aa9716b898ec8',
            to: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
            blockNumber: 1002,
            networkId: 137,
            blockchain: 'MATIC',
          },
        ],
      });
    });

    it('should return one result if domain has no transfers in another network', async () => {
      const { domain: testDomain } = await DomainTestHelper.createTestDomainL2(
        {
          name: 'kirill.dao',
          node: '0x06fd626e68ed0311d37c040c788137dc168124856fdb3b5ec37f54e98dd764ef',
        },
        {
          ownerAddress: '0xea674fdde714fd979de3edf0f56aa9716b898ec8',
          registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
        },
        {
          ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
          registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
        },
      );
      await saveCnsEvents(
        testDomain.node,
        [],
        [
          {
            from: '0x0000000000000000000000000000000000000000',
            to: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
          },
          {
            from: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
            to: '0xea674fdde714fd979de3edf0f56aa9716b898ec8',
          },
          {
            from: '0xea674fdde714fd979de3edf0f56aa9716b898ec8',
            to: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
          },
        ],
      );

      const res = await supertest(api)
        .get(`/domains/${testDomain.name}/transfers/latest`)
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();

      expect(res.status).eq(200);
      expect(res.body).to.deep.eq({
        data: [
          {
            domain: testDomain.name,
            from: '0xea674fdde714fd979de3edf0f56aa9716b898ec8',
            to: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
            blockNumber: 1002,
            networkId: 137,
            blockchain: 'MATIC',
          },
        ],
      });
    });

    it('should return error for zil domain', async () => {
      const res = await supertest(api)
        .get(`/domains/test.zil/transfers/latest`)
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();

      expect(res.status).eq(400);
      expect(res.body.code).to.eq('BadRequestError');
      expect(res.body.message).to.eq(
        `Invalid params, check 'errors' property for more info.`,
      );
      expect(res.body.errors).to.deep.eq([
        {
          children: [],
          constraints: {
            'validate domainName with isNotZilDomain': '',
          },
          property: 'domainName',
          target: {
            domainName: 'test.zil',
          },
          value: 'test.zil',
        },
      ]);
    });
  });

  describe('Errors handling', () => {
    it('should format the 500 error', async () => {
      const connection = getConnection();
      connection.close();
      const res = await supertest(api)
        .get('/domains/brad.crypto')
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(res.status).eq(500);
      expect(res.body.code).to.exist;
      expect(res.body.message).to.exist;
      expect(res.body.errors).to.exist;
      expect(res.body.stack).to.not.exist;
      await connection.connect(); // restore the connection to the db;
    });
    it('should return appropriate error for missing an owner param', async () => {
      const res = await supertest(api)
        .get('/domains/')
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(res.status).eq(400);
      expect(res.body).containSubset({
        code: 'BadRequestError',
        message: "Invalid queries, check 'errors' property for more info.",
        errors: [
          {
            property: 'owners',
            constraints: {
              arrayNotEmpty: 'owners should not be empty',
              isArray: 'owners must be an array',
              isNotEmpty: 'each value in owners should not be empty',
              isString: 'each value in owners must be a string',
            },
          },
        ],
      });
    });
    it('should return appropriate error for incorrect input', async () => {
      const res = await supertest(api)
        .get(
          '/domains?owners[]=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2&perPage=0',
        )
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();

      expect(res.status).eq(400);
      expect(res.body.code).to.exist;
      expect(res.body.message).to.exist;
      expect(res.body).to.containSubset({
        code: 'BadRequestError',
        message: "Invalid queries, check 'errors' property for more info.",
        errors: [
          {
            property: 'perPage',
            constraints: {
              min: 'perPage must not be less than 1',
            },
          },
        ],
      });
    });

    it('should return error for incorrect tlds', async () => {
      const res = await supertest(api)
        .get(
          '/domains?owners[]=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2&tlds=crypto&tlds=test',
        )
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();

      expect(res.status).eq(400);
      expect(res.body.code).to.exist;
      expect(res.body.message).to.exist;
      expect(res.body).to.containSubset({
        code: 'BadRequestError',
        message: "Invalid queries, check 'errors' property for more info.",
        errors: [
          {
            property: 'tlds',
            constraints: {
              'validate tlds with validTlds': 'Invalid TLD list provided',
            },
          },
        ],
      });
    });
  });

  describe('GET /domains sorting and filtration', () => {
    let testDomains: {
      domain: Domain;
      resolutions: DomainsResolution[];
    }[] = [];
    // Test domains list:
    // 0: .crypto domain on L1
    // 1: .crypto domain on L2
    // 2: .wallet domain on L1
    // 3: .wallet domain on L2
    // 4: .zil domain on ZNS
    // All domains have same owner and resolution
    beforeEach(async () => {
      testDomains = [];
      testDomains.push(
        await DomainTestHelper.createTestDomainL2(
          {
            name: 'testa.crypto',
            node: '0xc1ff26b9cedbcf2f0408961898aae4ba65e9acd08543eebf7676482c8a23dba8',
          },
          {
            registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
            ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
          },
          {
            registry: '0xa9a6a3626993d487d2dbda3173cf58ca1a9d9e9f',
            ownerAddress: Domain.NullAddress,
          },
        ),
      );

      testDomains.push(
        await DomainTestHelper.createTestDomainL2(
          {
            name: 'testb.crypto',
            node: '0xe952ce3758282cce878760001be22370f4842793139518e119ae04ae24004206',
          },
          {
            registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
            ownerAddress: Domain.NullAddress,
          },
          {
            registry: '0xa9a6a3626993d487d2dbda3173cf58ca1a9d9e9f',
            ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
          },
        ),
      );

      testDomains.push(
        await DomainTestHelper.createTestDomainL2(
          {
            name: 'testa.wallet',
            node: '0x04d4bba9f230ea6c78c1e6b37d268106ac90e0bdcd2dd8322895c0fca5800729',
          },
          {
            registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
            ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
          },
          {
            registry: '0xa9a6a3626993d487d2dbda3173cf58ca1a9d9e9f',
            ownerAddress: Domain.NullAddress,
          },
        ),
      );

      testDomains.push(
        await DomainTestHelper.createTestDomainL2(
          {
            name: 'testb.wallet',
            node: '0xfa8911cd87a6dac8310914c86952e6d451c92e03663cd1190032816a9d59edf3',
          },
          {
            registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
            ownerAddress: Domain.NullAddress,
          },
          {
            registry: '0xa9a6a3626993d487d2dbda3173cf58ca1a9d9e9f',
            ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
          },
        ),
      );

      const { domain: zilDomain, resolution: zilResolution } =
        await DomainTestHelper.createTestDomain({
          blockchain: Blockchain.ZIL,
          networkId: env.APPLICATION.ZILLIQA.NETWORK_ID,
          name: 'test1.zil',
          node: '0xc0cfff0bacee0844926d425ce027c3d05e09afaa285661aca11c5a97639ef001',
          ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
          registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08bbeadb',
        });
      testDomains.push({ domain: zilDomain, resolutions: [zilResolution] });
    });

    function getSortedTestDomains(
      sortFunc: (
        a: { domain: Domain; resolution: DomainsResolution },
        b: { domain: Domain; resolution: DomainsResolution },
      ) => number,
    ) {
      const expectedData = testDomains
        .map((dom) => {
          // simple filter to get expected data
          const resolution =
            dom.resolutions[0].ownerAddress ===
            '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2'
              ? dom.resolutions[0]
              : dom.resolutions[1];
          return {
            id: dom.domain.name,
            attributes: {
              meta: {
                domain: dom.domain.name,
                blockchain: resolution.blockchain,
                networkId: resolution.networkId,
                owner: resolution.ownerAddress,
                registry: resolution.registry,
                resolver: resolution.resolver,
              },
              records: {},
            },
            sortingFields: {
              domain: dom.domain,
              resolution,
            },
          };
        })
        .sort((a, b) => sortFunc(a.sortingFields, b.sortingFields));
      return {
        domains: expectedData.map(({ sortingFields }) => sortingFields.domain),
        expectedData: expectedData.map(({ sortingFields, ...keep }) => keep),
      };
    }

    it('should sort by domain name ascending', async () => {
      const { domains, expectedData } = getSortedTestDomains((a, b) =>
        a.domain.name.localeCompare(b.domain.name),
      );

      const res = await supertest(api)
        .get(
          `/domains?owners[]=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2&sortBy=name`,
        )
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();

      expect(res.status).eq(200);
      expect(res.body.data).to.exist;
      expect(res.body.data).to.deep.equal(expectedData);
      expect(res.body.meta).to.deep.equal({
        hasMore: false,
        nextStartingAfter: domains[domains.length - 1].name,
        perPage: 100,
        sortBy: 'name',
        sortDirection: 'ASC',
      });
    });

    it('should sort by domain name descending', async () => {
      const { domains, expectedData } = getSortedTestDomains(
        (a, b) => -a.domain.name.localeCompare(b.domain.name),
      );

      const res = await supertest(api)
        .get(
          `/domains?owners[]=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2&sortBy=name&sortDirection=DESC`,
        )
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();

      expect(res.status).eq(200);
      expect(res.body.data).to.exist;
      expect(res.body.data).to.deep.equal(expectedData);
      expect(res.body.meta).to.deep.equal({
        hasMore: false,
        nextStartingAfter: domains[domains.length - 1].name,
        perPage: 100,
        sortBy: 'name',
        sortDirection: 'DESC',
      });
    });
    it('should sort by domain id ascending by default', async () => {
      const { domains, expectedData } = getSortedTestDomains(
        (a, b) => (a.domain.id || 0) - (b.domain.id || 0),
      );

      const res = await supertest(api)
        .get(`/domains?owners[]=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2`)
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();

      expect(res.status).eq(200);
      expect(res.body.data).to.exist;
      expect(res.body.data).to.deep.equal(expectedData);
      expect(res.body.meta).to.deep.equal({
        hasMore: false,
        nextStartingAfter: domains[domains.length - 1].id?.toString(),
        perPage: 100,
        sortBy: 'id',
        sortDirection: 'ASC',
      });
    });

    it('should sort by domain id descending', async () => {
      const { domains, expectedData } = getSortedTestDomains(
        (a, b) => (b.domain.id || 0) - (a.domain.id || 0),
      );

      const res = await supertest(api)
        .get(
          `/domains?owners[]=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2&sortBy=id&sortDirection=DESC`,
        )
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();

      expect(res.status).eq(200);
      expect(res.body.data).to.exist;
      expect(res.body.data).to.deep.equal(expectedData);
      expect(res.body.meta).to.deep.equal({
        hasMore: false,
        nextStartingAfter: domains[domains.length - 1].id?.toString(),
        perPage: 100,
        sortBy: 'id',
        sortDirection: 'DESC',
      });
    });

    it('should sort with starting after', async () => {
      const { domains, expectedData } = getSortedTestDomains(
        (a, b) => -a.domain.name.localeCompare(b.domain.name),
      );

      const res = await supertest(api)
        .get(
          `/domains?owners=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2&sortBy=name&sortDirection=DESC&perPage=1&startingAfter=${domains[1].name}`,
        )
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();

      expect(res.status).eq(200);
      expect(res.body.data).to.exist;
      expect(res.body.data).to.deep.equal([expectedData[2]]);
      expect(res.body.meta).to.deep.equal({
        hasMore: true,
        nextStartingAfter: domains[2].name,
        perPage: 1,
        sortBy: 'name',
        sortDirection: 'DESC',
      });
    });

    it('should return error for invalid sortBy', async () => {
      const res = await supertest(api)
        .get(
          `/domains?owners=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2&sortBy=invalid`,
        )
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();

      expect(res.status).eq(400);
      expect(res.body).containSubset({
        errors: [
          {
            constraints: {
              isIn: 'sortBy must be one of the following values: id, name',
            },
          },
        ],
      });
    });

    it('should return error for invalid sortDirection', async () => {
      const res = await supertest(api)
        .get(
          `/domains?owners[]=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2&sortDirection=invalid`,
        )
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();

      expect(res.status).eq(400);
      expect(res.body).containSubset({
        errors: [
          {
            constraints: {
              isIn: 'sortDirection must be one of the following values: ASC, DESC',
            },
          },
        ],
      });
    });
  });
});
