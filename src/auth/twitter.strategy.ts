// import { Injectable } from '@nestjs/common';
// import { PassportStrategy } from '@nestjs/passport';
// import { Strategy } from 'passport-oauth2';
// import { ConfigService } from '@nestjs/config';
// import { AuthService } from './auth.service';

// @Injectable()
// export class TwitterStrategy extends PassportStrategy(Strategy, 'twitter') {
//   constructor(
//     private authService: AuthService,
//     private configService: ConfigService
//   ) {
//     super({
//       authorizationURL: 'https://twitter.com/i/oauth2/authorize',
//       tokenURL: 'https://api.twitter.com/2/oauth2/token',
//       clientID: configService.get<string>('TWITTER_CLIENT_ID'),
//       clientSecret: configService.get<string>('TWITTER_CLIENT_SECRET'),
//       callbackURL: configService.get<string>('TWITTER_CALLBACK_URL'),
//       scope: ['tweet.read', 'users.read', 'offline.access'],
//       pkce: true,
//       state: true,
//     });
//   }

//   userProfile(accessToken: string, done: (err?: Error | null, profile?: any) => void) {
//     this._oauth2.get(
//       'https://api.twitter.com/2/users/me?user.fields=id,name,username,profile_image_url',
//       accessToken,
//       (err, body) => {
//         if (err) {
//           return done(err);
//         }
//         try {
//           const json = JSON.parse(body as string);
//           const profile = {
//             provider: 'twitter',
//             id: json.data.id,
//             username: json.data.username,
//             displayName: json.data.name,
//             profileImageUrl: json.data.profile_image_url,
//           };
//           done(null, profile);
//         } catch (e) {
//           done(e);
//         }
//       }
//     );
//   }

//   async validate(accessToken: string, refreshToken: string, profile: any, done: Function) {
//     const user = await this.authService.validateOAuthLogin(profile, accessToken, refreshToken);
//     done(null, user);
//   }
// }

import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-twitter';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';

@Injectable()
export class TwitterStrategy extends PassportStrategy(Strategy, 'twitter') {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {
    super({
      consumerKey: configService.get<string>('TWITTER_APP_KEY'),
      consumerSecret: configService.get<string>('TWITTER_APP_SECRET'),
      callbackURL: configService.get<string>('TWITTER_CALLBACK_URL'),
      includeEmail: true, // Requires approved Twitter developer account
    });
  }

  async validate(
    token: string,
    tokenSecret: string,
    profile: any,
    done: Function,
  ): Promise<any> {
    try {
      const { id, username, displayName, emails, photos } = profile;
      console.log('Twitter Profile', JSON.stringify(profile, null, 2));
      const userProfile = {
        provider: 'twitter',
        id: id,
        username: username,
        displayName: displayName,
        email: emails && emails.length > 0 ? emails[0].value : null,
        profileImageUrl: photos && photos.length > 0 ? photos[0].value : null,
      };
      console.log({ userProfile });
      const user = await this.authService.validateOAuthLogin(
        userProfile,
        token,
        tokenSecret,
      );

      console.log('User after validation', user);

      done(null, user);
    } catch (err) {
      done(err, false);
    }
  }
}
