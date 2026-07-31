import { Module } from '@nestjs/common';
import {
  I18nModule,
  AcceptLanguageResolver,
  HeaderResolver,
  QueryResolver,
} from 'nestjs-i18n';
import * as path from 'path';

@Module({
  imports: [
    I18nModule.forRoot({
      fallbackLanguage: 'uk',
      loaderOptions: {
        path: path.join(process.cwd(), 'src', 'shared-kernel', 'infrastructure', 'i18n', 'translations'),
        watch: true,
      },
      resolvers: [
        new AcceptLanguageResolver(),
        new HeaderResolver(['x-lang']),
        new QueryResolver(['lang']),
      ],
    }),
  ],
})
export class SharedI18nModule {}
