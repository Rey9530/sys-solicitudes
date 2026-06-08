import { Module } from '@nestjs/common';
import { ReportesController } from './reportes.controller';
import { ReportesService } from './reportes.service';
import { JsreportService } from './jsreport.service';
import { KpiSnapshotCron } from './cron/kpi-snapshot.cron';

@Module({
  controllers: [ReportesController],
  providers: [ReportesService, JsreportService, KpiSnapshotCron],
  exports: [ReportesService],
})
export class ReportesModule {}
