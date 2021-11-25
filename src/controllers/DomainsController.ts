import 'reflect-metadata';
import {
  Get,
  JsonController,
  Param,
  QueryParams,
  UseBefore,
} from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { CnsRegistryEvent, Domain } from '../models';
import { ApiKeyAuthMiddleware } from '../middleware/ApiKeyAuthMiddleware';
import { getDomainResolution } from '../services/Resolution';
import { eip137Namehash } from '../utils/namehash';
import {
  DomainResponse,
  DomainsListQuery,
  DomainsListResponse,
  UnsDomainQuery,
  DomainLatestTransferResponse,
} from './dto/Domains';
import { ConvertArrayQueryParams } from '../middleware/ConvertArrayQueryParams';

@OpenAPI({
  security: [{ apiKeyAuth: [] }],
})
@JsonController()
@UseBefore(ApiKeyAuthMiddleware)
export class DomainsController {
  @Get('/domains/:domainName')
  @ResponseSchema(DomainResponse)
  async getDomain(
    @Param('domainName') domainName: string,
  ): Promise<DomainResponse> {
    domainName = domainName.toLowerCase();
    const domain = await Domain.findOne({
      where: { name: domainName },
      relations: ['resolutions'],
    });
    if (domain) {
      const resolution = getDomainResolution(domain);
      const response = new DomainResponse();
      response.meta = {
        domain: domain.name,
        blockchain: resolution.blockchain,
        networkId: resolution.networkId,
        owner: resolution.ownerAddress,
        resolver: resolution.resolver,
        registry: resolution.registry,
      };
      response.records = resolution.resolution;
      return response;
    }
    return {
      meta: {
        domain: domainName,
        owner: null,
        resolver: null,
        registry: null,
        blockchain: null,
        networkId: null,
      },
      records: {},
    };
  }

  @Get('/domains')
  @OpenAPI({
    responses: {
      '200': {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                data: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/DomainAttributes',
                  },
                },
              },
            },
          },
        },
      },
    },
  })
  @UseBefore(ConvertArrayQueryParams('owners'))
  @UseBefore(ConvertArrayQueryParams('tlds'))
  async getDomainsList(
    @QueryParams() query: DomainsListQuery,
  ): Promise<DomainsListResponse> {
    const ownersQuery = query.owners.map((owner) => owner.toLowerCase());

    // Use raw query becaues typeorm doesn't seem to handle multiple nested relations (e.g. resolution.domain.parent.name)
    const where = [];
    if (query.tlds) {
      where.push({
        query: `"parent"."name" in (:...tlds)`,
        parameters: { tlds: query.tlds },
      });
    }

    if (query.startingAfter.length !== 0) {
      where.push({
        query: `${query.sort.column} ${
          query.sort.direction === 'ASC' ? '>' : '<'
        } :startingAfter`,
        parameters: { startingAfter: query.startingAfter },
      });
    }

    const qb = Domain.createQueryBuilder('domain');
    qb.leftJoinAndSelect('domain.resolutions', 'resolution');
    qb.leftJoinAndSelect('domain.parent', 'parent');
    qb.where(`"resolution"."owner_address" in (:...owners)`, {
      owners: ownersQuery,
    });
    for (const q of where) {
      qb.andWhere(q.query, q.parameters);
    }
    qb.orderBy(query.sort.column, query.sort.direction);
    qb.take(query.perPage + 1);
    const domains = await qb.getMany();
    const hasMore = domains.length > query.perPage;
    if (hasMore) {
      domains.pop();
    }
    const lastDomain =
      domains.length !== 0 ? domains[domains.length - 1] : undefined;

    const response = new DomainsListResponse();
    response.data = [];
    for (const domain of domains) {
      const resolution = getDomainResolution(domain);
      response.data.push({
        id: domain.name,
        attributes: {
          meta: {
            domain: domain.name,
            blockchain: resolution.blockchain,
            networkId: resolution.networkId,
            owner: resolution.ownerAddress,
            resolver: resolution.resolver,
            registry: resolution.registry,
          },
          records: resolution.resolution,
        },
      });
    }
    response.meta = {
      perPage: query.perPage,
      nextStartingAfter:
        lastDomain?.[query.sortBy]?.toString() || query.startingAfter || '',
      sortBy: query.sortBy,
      sortDirection: query.sortDirection,
      hasMore,
    };
    return response;
  }

  @Get('/domains/:domainName/transfers/latest')
  async getDomainsLastTransfer(
    @QueryParams() query: UnsDomainQuery,
  ): Promise<DomainLatestTransferResponse> {
    const namehash = eip137Namehash(query.domainName);
    const maxBlockNumbersQuery = CnsRegistryEvent.createQueryBuilder('event');
    maxBlockNumbersQuery.addSelect('MAX(event.blockNumber)', 'blockNumber');
    maxBlockNumbersQuery.addSelect('event.blockchain');
    maxBlockNumbersQuery.addSelect('event.node');
    maxBlockNumbersQuery.where(
      `event.node = :namehash AND event.type = :eventType AND event.blockchain <> :excludedBlockchain`,
      {
        namehash,
        eventType: 'Transfer',
        excludedBlockchain: 'ZIL',
      },
    );
    maxBlockNumbersQuery.groupBy('event.blockchain, event.node');
    const maxBlockNumberEvents = await maxBlockNumbersQuery.getMany();
    const lastTransfersQuery = CnsRegistryEvent.createQueryBuilder('event');
    maxBlockNumberEvents.forEach((event: CnsRegistryEvent) => {
      lastTransfersQuery.orWhere(
        `event.blockNumber = :blockNumber AND event.type = :eventType AND node = :namehash AND blockchain = :blockchain`,
        {
          blockNumber: event.blockNumber,
          eventType: 'Transfer',
          namehash,
          blockchain: event.blockchain,
        },
      );
    });
    const response = new DomainLatestTransferResponse();
    const lastTransferEvents = await lastTransfersQuery.getMany();
    response.data = lastTransferEvents.map((event) => {
      return {
        domain: query.domainName,
        from: event?.returnValues?.from,
        to: event?.returnValues?.to,
        networkId: event.networkId,
        blockNumber: event.blockNumber,
        blockchain: event.blockchain,
      };
    });
    return response;
  }
}
