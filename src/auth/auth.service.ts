// import { Injectable } from '@nestjs/common';
// import { JwtService } from '@nestjs/jwt';
// import * as bcrypt from 'bcrypt';
// import { UsersService } from '../users/users.service';

// @Injectable()
// export class AuthService {
//   constructor(
//     private usersService: UsersService,
//     private jwtService: JwtService,
//   ) {}

//   async validateUser(username: string, pass: string): Promise<any> {
//     const user = await this.usersService.findOne(username);
//     if (user && (await bcrypt.compare(pass, user.password as string))) {
//       const { password, ...result } = user;
//       return result;
//     }
//     return null;
//   }

//   async login(user: any) {
//     const payload = { username: user.username, sub: user._id, role: user.role };
//     return {
//       access_token: this.jwtService.sign(payload),
//     };
//   }
//   async validateOAuthLogin(
//     profile: any,
//     accessToken: string,
//     refreshToken: string,
//   ) {
//     const { id, username, emails } = profile;
//     let user: any = await this.usersService.findByXId(id);
//     if (!user) {
//       const email =
//         emails && emails[0] ? emails[0].value : `${username}@twitter.com`;
//       user = await this.usersService.create({
//         username,
//         email,
//         xId: id,
//         accessToken,
//         refreshToken,
//       });
//     } else {
//       user.accessToken = accessToken;
//       user.refreshToken = refreshToken;
//       await this.usersService.findByIdAndUpdate(user._id, user);
//     }
//     return user;
//   }
// }

import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(username: string, pass: string): Promise<any> {
    const user = await this.usersService.findOne(username);
    if (user && (await bcrypt.compare(pass, user.password as string))) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = { username: user.username, sub: user._id, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async validateOAuthLogin(
    profile: any,
    accessToken: string,
    refreshToken: string,
  ) {
    const { id, username, email, displayName, profileImageUrl } = profile;

    // Try to find existing user by Twitter ID
    let user: any = await this.usersService.findByXId(id);

    if (!user) {
      // Create new user if doesn't exist
      const userData = {
        username: username || `twitter_${id}`,
        email: email || `${username}@twitter.placeholder.com`,
        // displayName: displayName,
        xId: id,
        profileImageUrl: profileImageUrl,
        accessToken,
        refreshToken,
      };

      user = await this.usersService.create(userData);
    } else {
      // Update existing user's tokens
      user.accessToken = accessToken;
      user.refreshToken = refreshToken;
      if (profileImageUrl) user.profileImageUrl = profileImageUrl;

      await this.usersService.findByIdAndUpdate(user._id, user);
    }

    return user;
  }
}
