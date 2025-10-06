import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    try {
      const salt = await bcrypt.genSalt();
      let hashedPassword: string | undefined;
      if (createUserDto.password) {
        hashedPassword = await bcrypt.hash(createUserDto?.password, salt);
      }
      const createdUser = new this.userModel({
        ...createUserDto,
        password: hashedPassword,
      });

      const user = await createdUser.save();
      // Manually remove password from the returned object
      const { password, ...userWithoutPassword } = user.toObject();
      return userWithoutPassword;
    } catch (error) {
      if (error.code === 11000) {
        throw new BadRequestException('Username or email already exists.');
      }
      throw error;
    }
  }

  async findOne(username: string): Promise<User | undefined> {
    const user = await this.userModel
      .findOne({ username })
      .select('+password')
      .exec();
    if (!user) {
      throw new BadRequestException('User not found.');
    }
    return user;
  }

  async findById(id: string): Promise<User | undefined> {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new BadRequestException('User not found.');
    }
    return user;
  }

  async findByXId(xId: string): Promise<User | undefined> {
    const user = await this.userModel.findOne({ xId }).exec();
    if (!user) {
      throw new BadRequestException('User not found.');
    }
    return user;
  }

  async findByIdAndUpdate(
    id: string,
    userPayload: User,
  ): Promise<User | undefined> {
    const user = await this.userModel
      .findByIdAndUpdate(id, userPayload, { new: true })
      .exec();
    if (!user) {
      throw new BadRequestException('User not found.');
    }
    return user;
  }
}
