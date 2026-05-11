# Phase 01 — NestJS Bootstrap

**Status:** ⏳ Pending  
**Priority:** 🔴 Critical  
**Effort:** ~3 hours  
**Depends on:** Sprint 0 Phase 01 (gateway-nest/ workspace exists)

## Overview

Setup NestJS application skeleton trong `gateway-nest/`: module structure, TypeORM connection tới MSSQL, config module cho env vars, global error handling, CORS.

## Files to Create

```
gateway-nest/src/
├── app.module.ts
├── main.ts                    (update từ skeleton)
├── config/
│   └── configuration.ts       environment config
├── database/
│   ├── data-source.ts         TypeORM DataSource (từ Phase Sprint-0-05)
│   └── database.module.ts     NestJS TypeORM module setup
└── common/
    ├── filters/
    │   └── http-exception.filter.ts   global exception filter
    └── interceptors/
        └── transform.interceptor.ts   response transform
```

## Implementation

### gateway-nest/src/config/configuration.ts

```typescript
export default () => ({
  port: parseInt(process.env.PORT ?? '4000', 10),
  jwt: {
    secret: process.env.JWT_SECRET ?? 'change-me',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '24h',
  },
  database: {
    mssql: {
      host: process.env.MSSQL_HOST ?? 'localhost',
      port: parseInt(process.env.MSSQL_PORT ?? '1433', 10),
      username: process.env.MSSQL_USER ?? 'sa',
      password: process.env.MSSQL_PASSWORD ?? '',
      database: process.env.MSSQL_DATABASE ?? 'intellipark',
    },
    postgres: {
      host: process.env.POSTGRES_HOST ?? 'localhost',
      port: parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
      username: process.env.POSTGRES_USER ?? 'intellipark',
      password: process.env.POSTGRES_PASSWORD ?? '',
      database: process.env.POSTGRES_DATABASE ?? 'intellipark_analytics',
    },
  },
  redis: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  },
  camera: {
    encryptionKey: process.env.CAMERA_ENCRYPTION_KEY ?? '',
  },
});
```

### gateway-nest/src/app.module.ts

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'mssql',
        host: config.get('database.mssql.host'),
        port: config.get('database.mssql.port'),
        username: config.get('database.mssql.username'),
        password: config.get('database.mssql.password'),
        database: config.get('database.mssql.database'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
        synchronize: false,
        options: {
          encrypt: process.env.NODE_ENV === 'production',
          trustServerCertificate: process.env.NODE_ENV !== 'production',
        },
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

### gateway-nest/src/main.ts (updated)

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix
  app.setGlobalPrefix('api');

  // CORS — chỉ allow frontend domain
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,  // cần cho httpOnly cookies
  });

  // Global validation pipe — tự động validate DTOs với class-validator
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,      // strip unknown fields
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global transform interceptor (wrap response trong { data, statusCode, message })
  app.useGlobalInterceptors(new TransformInterceptor());

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  console.log(`Gateway running on port ${port} — NODE_ENV: ${process.env.NODE_ENV}`);
}
bootstrap();
```

### gateway-nest/src/common/filters/http-exception.filter.ts

```typescript
import {
  ExceptionFilter, Catch, ArgumentsHost,
  HttpException, HttpStatus, Logger
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = exception instanceof HttpException
      ? exception.message
      : 'Internal server error';

    if (status >= 500) {
      this.logger.error(exception);
    }

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}
```

### gateway-nest/src/common/interceptors/transform.interceptor.ts

```typescript
import {
  Injectable, NestInterceptor, ExecutionContext, CallHandler
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map(data => ({
        statusCode: context.switchToHttp().getResponse().statusCode,
        data,
      }))
    );
  }
}
```

## Dependencies to Add

```bash
# Từ gateway-nest/
npm install @nestjs/config @nestjs/typeorm typeorm mssql
npm install @nestjs/passport @nestjs/jwt passport passport-jwt
npm install bcryptjs class-validator class-transformer
npm install @types/bcryptjs @types/passport-jwt --save-dev
```

## Todo List

- [ ] Cài dependencies (config, typeorm, passport, jwt, bcrypt, validator)
- [ ] Tạo `src/config/configuration.ts`
- [ ] Tạo `src/app.module.ts` với TypeORM và Config modules
- [ ] Cập nhật `src/main.ts` với CORS, ValidationPipe, global filter/interceptor
- [ ] Tạo `src/common/filters/http-exception.filter.ts`
- [ ] Tạo `src/common/interceptors/transform.interceptor.ts`
- [ ] Test: `npm run dev` khởi động NestJS, connect MSSQL không lỗi
- [ ] Test: `GET http://localhost:4000/api` trả về 404 (gateway đang chạy)

## Success Criteria

- NestJS khởi động thành công với TypeORM connected tới MSSQL
- Unknown routes trả 404 với đúng JSON format
- Invalid requests (wrong body) bị reject bởi ValidationPipe với 400
- CORS header `Access-Control-Allow-Origin: http://localhost:3000` có trong response

## Security Considerations

- `CAMERA_ENCRYPTION_KEY` phải validate length (32 bytes / 64 hex chars) khi startup
- JWT secret phải minimum 32 chars — throw error khi bootstrap nếu quá ngắn
- `trustServerCertificate: true` chỉ ở dev mode — production phải dùng proper cert
