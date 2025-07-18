import { Controller, Get, Post, Body, HttpCode, HttpStatus, Param } from '@nestjs/common'
import { RhinestoneWebsocketService } from '../services/rhinestone-websocket.service'
import { RhinestoneApiService } from '../services/rhinestone-api.service'
import { RhinestoneService } from '../services/rhinestone.service'
import { Hash } from 'viem'

@Controller('rhinestone')
export class RhinestoneTestController {
  constructor(
    private readonly rhinestoneWebsocket: RhinestoneWebsocketService,
    private readonly rhinestoneApi: RhinestoneApiService,
    private readonly rhinestoneService: RhinestoneService,
  ) {}

  @Get('status')
  getStatus() {
    return {
      connected: this.rhinestoneWebsocket.isConnected(),
      readyState: this.rhinestoneWebsocket.getReadyState(),
      readyStateText: this.getReadyStateText(this.rhinestoneWebsocket.getReadyState()),
    }
  }

  @Post('connect')
  @HttpCode(HttpStatus.OK)
  async connect() {
    await this.rhinestoneWebsocket.connect()
    return { message: 'Connection initiated' }
  }

  @Post('disconnect')
  @HttpCode(HttpStatus.OK)
  async disconnect() {
    await this.rhinestoneWebsocket.disconnect()
    return { message: 'Disconnected' }
  }

  @Post('send')
  @HttpCode(HttpStatus.OK)
  async sendMessage(@Body() body: any) {
    await this.rhinestoneWebsocket.send(body)
    return { message: 'Message sent', data: body }
  }

  @Post('send-ping')
  @HttpCode(HttpStatus.OK)
  async sendPing() {
    const pingMessage = {
      type: 'Ping',
      timestamp: Date.now(),
    }
    await this.rhinestoneWebsocket.send(pingMessage)
    return { message: 'Ping sent', data: pingMessage }
  }

  @Post('send-bundle')
  @HttpCode(HttpStatus.OK)
  async sendBundle(@Body() body: any) {
    // Send the bundle message through WebSocket
    await this.rhinestoneWebsocket.send(body)
    return { message: 'Bundle message sent', data: body }
  }

  @Post('bundles/:bundleId/events')
  @HttpCode(HttpStatus.OK)
  async postBundleEvent(
    @Param('bundleId') bundleId: string,
    @Body() body: { type: 'FillPreconfirmation'; chainId: number; txHash: Hash },
  ) {
    return this.rhinestoneApi.postBundleEvent(bundleId, body)
  }

  @Post('bundles/:bundleId/fill-preconfirmation')
  @HttpCode(HttpStatus.OK)
  async postFillPreconfirmation(
    @Param('bundleId') bundleId: string,
    @Body() body: { chainId: number; txHash: Hash },
  ) {
    return this.rhinestoneApi.postFillPreconfirmation(bundleId, body.chainId, body.txHash)
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
