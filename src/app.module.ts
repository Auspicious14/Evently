import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EventsModule } from './events/events.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { XIntegrationModule } from './x-integration/x-integration.module';
import { LinksModule } from './links/links.module';
import { AccessRequestsModule } from './access-requests/access-requests.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGO_URI'),
      }),
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),
    EventsModule,
    UsersModule,
    AuthModule,
    XIntegrationModule,
    LinksModule,
    AccessRequestsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}