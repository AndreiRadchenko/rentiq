import { Module } from '@nestjs/common';
import {
  I18nModule,
  AcceptLanguageResolver,
  HeaderResolver,
  QueryResolver,
} from 'nestjs-i18n';
import * as path from 'path';
import { JwtLocaleResolver } from './jwt-locale.resolver';

@Module({
  imports: [
    I18nModule.forRoot({
      fallbackLanguage: 'uk',
      disableMiddleware: true,
      loaderOptions: {
        path: path.join(process.cwd(), 'src', 'shared-kernel', 'infrastructure', 'i18n', 'translations'),
        watch: true,
      },
      resolvers: [
        new JwtLocaleResolver(),
        new AcceptLanguageResolver(),
        new HeaderResolver(['x-lang']),
        new QueryResolver(['lang']),
      ],
    }),
  ],
})
export class SharedI18nModule {}
