import { Controller, Get, Post, Body, HttpCode, HttpStatus } from '@nestjs/common'
import { RhinestoneWebsocketService } from '../services/rhinestone-websocket.service'

@Controller('rhinestone')
export class RhinestoneTestController {
  constructor(private readonly rhinestoneService: RhinestoneWebsocketService) {}

  @Get('status')
  getStatus() {
    return {
      connected: this.rhinestoneService.isConnected(),
      readyState: this.rhinestoneService.getReadyState(),
      readyStateText: this.getReadyStateText(this.rhinestoneService.getReadyState()),
    }
  }

  @Post('connect')
  @HttpCode(HttpStatus.OK)
  async connect() {
    await this.rhinestoneService.connect()
    return { message: 'Connection initiated' }
  }

  @Post('disconnect')
  @HttpCode(HttpStatus.OK)
  async disconnect() {
    await this.rhinestoneService.disconnect()
    return { message: 'Disconnected' }
  }

  @Post('send')
  @HttpCode(HttpStatus.OK)
  async sendMessage(@Body() body: any) {
    await this.rhinestoneService.send(body)
    return { message: 'Message sent', data: body }
  }

  @Post('send-ping')
  @HttpCode(HttpStatus.OK)
  async sendPing() {
    const pingMessage = {
      type: 'Ping',
      timestamp: Date.now(),
    }
    await this.rhinestoneService.send(pingMessage)
    return { message: 'Ping sent', data: pingMessage }
  }

  @Post('send-bundle')
  @HttpCode(HttpStatus.OK)
  async sendBundle(@Body() body: { data: any; id?: string }) {
    const bundleMessage = {
      type: 'RhinestoneBundle',
      data: body.data,
      id: body.id || Math.random().toString(36).substring(7),
    }
    await this.rhinestoneService.send(bundleMessage)
    return { message: 'Bundle message sent', data: bundleMessage }
  }

  private getReadyStateText(state: number | null): string {
    if (state === null) return 'Not initialized'
    switch (state) {
      case 0:
        return 'CONNECTING'
      case 1:
        return 'OPEN'
      case 2:
        return 'CLOSING'
      case 3:
        return 'CLOSED'
      default:
        return 'UNKNOWN'
    }
  }
}
