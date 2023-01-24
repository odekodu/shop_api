import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus, INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { Connection } from 'mongoose';
import { DatabaseService } from '../../../src/database/database.service';
import { AppModule } from '../../../src/app.module';
import { Fixture } from '../../fixture';
import { RedisCacheService } from '../../../src/redis-cache/redis-cache.service';
import { ConfigService } from '@nestjs/config';
import { expect } from 'chai';

describe('Update Task', () => {
  let app: INestApplication;
  let httpServer: any;
  let moduleFixture: TestingModule;
  let dbConnection: Connection;
  let fixture: Fixture;
  let redisCacheService: RedisCacheService;
  let configService: ConfigService;
  let user = null;
  let task = null;
  let token: string;

  before(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [
        AppModule
      ],
    }).compile();

    app = moduleFixture.createNestApplication();    
    await app.init();

    httpServer = app.getHttpServer();
    dbConnection = moduleFixture.get<DatabaseService>(DatabaseService).getConnection();
    redisCacheService = moduleFixture.get<RedisCacheService>(RedisCacheService);
    configService = moduleFixture.get<ConfigService>(ConfigService);
    fixture = new Fixture(dbConnection, redisCacheService, configService, );
  });

  beforeEach(async () => {
    user = await fixture.createUser();
    token = await fixture.login(user);
    await fixture.requestPassword(user.email);
    task = await fixture.createTask(user);
  });

  afterEach(async() => {
    await dbConnection.collection('users').deleteMany({});
  });

  after(async () => {
    await dbConnection.dropDatabase();
    await app.close();
    await moduleFixture.close();
  });

  it('should fail when invalid id is sent', async () => {        
    const response = await request(httpServer)
      .patch(`/tasks/${1}`)
      .set('token', token);

    expect(response.status).to.equal(HttpStatus.BAD_REQUEST);      
    expect(response.body).to.deep.include({
      success: false,
      message: '"id" is not a valid uuid'
    });
  });

  it('should fail when task is not found', async () => {   
    const id = task._id.toString().split('').reverse().join('');      
    const response = await request(httpServer)
      .patch(`/tasks/${id}`)
      .set('token', token);        
    
    expect(response.status).to.equal(HttpStatus.NOT_FOUND);      
    expect(response.body).to.deep.include({
      success: false,
      message: 'Task not found'
    });
  });

  it('should fail when invalid uri is provided', async () => {
    const response = await request(httpServer)
      .patch(`/tasks/${task._id}`)
      .set('token', token)
      .send({ uri: 'uri' });    

    expect(response.status).to.equal(HttpStatus.BAD_REQUEST);  
    expect(response.body).to.deep.include({
      success: false,
      message: '"uri" must be a valid uri'
    })  
  });

  it('should fail when invalid method is provided', async () => {
    const response = await request(httpServer)
      .patch(`/tasks/${task._id}`)
      .set('token', token)
      .send({ method: 'method' });    

    expect(response.status).to.equal(HttpStatus.BAD_REQUEST);  
    expect(response.body).to.deep.include({
      success: false,
      message: '"method" must be one of [get, post, put, patch, delete]'
    })  
  });

  it('should create the task', async () => {
    const response = await request(httpServer)
      .patch(`/tasks/${task._id}`)
      .set('token', token)
      .send({ title: 'new title' });    

    expect(response.status).to.equal(HttpStatus.OK);  
    expect(response.body.payload).to.deep.include({ title: 'new title'});  
  });
});