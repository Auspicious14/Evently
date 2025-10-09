import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { AccessRequestsService } from './access-requests.service';
import { AccessRequest } from './schemas/access-request.schema';
import { LinksService } from '../links/links.service';
import { UsersService } from '../users/users.service';

describe('AccessRequestsService', () => {
  let service: AccessRequestsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccessRequestsService,
        {
          provide: getModelToken(AccessRequest.name),
          useValue: {},
        },
        {
          provide: LinksService,
          useValue: {},
        },
        {
          provide: UsersService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<AccessRequestsService>(AccessRequestsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});