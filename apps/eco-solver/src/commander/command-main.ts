import { CommanderAppModule } from './commander-app.module'
import { CommandFactory } from 'nest-commander'
import { Logger } from 'nestjs-pino'

async function bootstrap() {
  try {
    const cmd = CommandFactory.createWithoutRunning(CommanderAppModule)
    const lg = (await cmd).get(Logger)
    ;(await cmd).useLogger(lg)
    await CommandFactory.runApplication(await cmd)
  } catch (e) {
    console.error(e)
  }
}
bootstrap()
