import { Module } from '@nestjs/common';
import { ReportesController } from './reportes.controller';
import { ReportesService } from './reportes.service';
import { JsreportService } from './jsreport.service';

@Module({
  controllers: [ReportesController],
  providers: [ReportesService, JsreportService],
  exports: [ReportesService],
})
export class ReportesModule {}
