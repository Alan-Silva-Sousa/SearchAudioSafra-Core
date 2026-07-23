import { Injectable } from '@nestjs/common';
import { CreateConfigDto } from './dto/create-config.dto';
import { UpdateConfigDto } from './dto/update-config.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Config } from './entities/config.entity';
import { Division } from './entities/division.entity';
import { GenesysService } from '../genesys/genesys.service';

@Injectable()
export class ConfigService {
  constructor(
    @InjectRepository(Config)
      private readonly configRepository: Repository<Config>,

      @InjectRepository(Division)
      private readonly divisionRepository: Repository<Division>,
      private readonly genesysService: GenesysService,
  ){}
  create(createConfigDto: CreateConfigDto) {
    return 'This action adds a new config';
  }

  findOne(id: number) {
    return `This action returns a #${id} config`;
  }

  update(id: number, updateConfigDto: UpdateConfigDto) {
    return `This action updates a #${id} config`;
  }

  remove(id: number) {
    return `This action removes a #${id} config`;
  }

  async findAllAgents(search: string): Promise<{ UserId: string; Username: string }[]> {
    const users = await this.genesysService.searchUsers(search);
    return users.map(u => ({ UserId: u.id, Username: u.name }));
  }

  async findAllDispositions(search?: string): Promise<{ DispositionId: string; Description: string }[]> {
    const codes = await this.genesysService.getWrapupCodes();
    const filtered = search
      ? codes.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
      : codes;
    return filtered.map(c => ({ DispositionId: c.id, Description: c.name }));
  }

  async findAllCampaigns(search?: string): Promise<{ CampaignId: string; Description: string }[]> {
    const divisions = await this.genesysService.getDivisions();
    const filtered = search
      ? divisions.filter(d => d.name.toLowerCase().includes(search.toLowerCase()))
      : divisions;
    return filtered.map(d => ({ CampaignId: d.id, Description: d.name }));
  }

  async findAllDivisions() {
    const genesysDivisions = await this.genesysService.getDivisions();
    if (!genesysDivisions || genesysDivisions.length === 0) {
      return [];
    }

    const divisionIds = genesysDivisions.map(d => d.id);
    const existing = await this.divisionRepository.find({
      where: { divisionId: In(divisionIds) },
    });

    const existingMap = new Map(existing.map(d => [d.divisionId, d]));

    return genesysDivisions
      .map(div => {
        const cfg = existingMap.get(div.id);
        return {
          id: cfg?.id ?? null,
          divisionId: div.id,
          name: div.name,
          retentionDays: cfg?.retentionDays ?? null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async updateDivision(divisionId: string, retentionDays: number | null) {
    const existing = await this.divisionRepository.findOne({ where: { divisionId } });
    if (existing) {
      existing.retentionDays = retentionDays;
      await this.divisionRepository.save(existing);
      return { success: true };
    }

    const genesysDivisions = await this.genesysService.getDivisions();
    const target = genesysDivisions.find(d => d.id === divisionId);
    if (!target) {
      return { success: false, message: 'Division not found in Genesys' };
    }

    const created = this.divisionRepository.create({
      divisionId: target.id,
      name: target.name,
      retentionDays,
    });
    await this.divisionRepository.save(created);
    return { success: true };
  }
}
