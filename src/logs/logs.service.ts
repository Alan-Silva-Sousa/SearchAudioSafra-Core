import { Injectable } from '@nestjs/common';
import { CreateLogDto } from './dto/create-log.dto';
import { UpdateLogDto } from './dto/update-log.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Log } from './entities/log.entity';
import { Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
@Injectable()
export class LogsService {
    constructor(
      @InjectRepository(Log)
      private logsRepository: Repository<Log>,
    ) {}

  create(createLogDto: CreateLogDto, userId) {
    return this.logsRepository.save({...createLogDto, userId});
  }

  findAll() {
    return this.logsRepository
        .createQueryBuilder('log')
        .leftJoin(User, 'user', 'user.id = log.UserId')   // ajuste coluna se for user_id
        .select([
          'log.id AS id',
          'log.action AS action',
          "log.time AT TIME ZONE 'America/Sao_Paulo' AS time",
          'user.email AS userEmail',
          'log.description as description',
          'log.audioName as audioName'
        ])
        .orderBy("id", "DESC")
        .getRawMany();   
      }

  findOne(id: number) {
    return `This action returns a #${id} log`;
  }

  update(id: number, updateLogDto: UpdateLogDto) {
    return `This action updates a #${id} log`;
  }

  remove(id: number) {
    return `This action removes a #${id} log`;
  }
}
