import { Controller, Get } from '@nestjs/common'
import { Logger } from '@nestjs/common'
import { SignerService } from './signer.service'

@Controller('sign')
export class SignController {
  private logger = new Logger(SignController.name)
  constructor(
    // private readonly aa: MultichainSmartAccountService,
    private readonly signer: SignerService,
  ) {}
  @Get()
  async fake() {
    await this.fakeSign()

    return
  }

  async fakeSign() {
    // const smartAccountClient = await this.aa.getClient(84532)
    // let ans = await smartAccountClient.account.getImplementationAddress()
    // console.log(ans, smartAccountClient.account.address)
    // await smartAccountClient.signUserOperation({
    //   // @ts-ignore
    //   uoStruct: this.getUo().flat(),
    //   account: this.atomicSigner.getSigner() as any,
    // })
    // // @ts-ignore
    // const uo = await smartAccountClient.sendUserOperation({
    //   uo: this.getUo().flat(),
    // })
    // const receipt = await smartAccountClient.waitForUserOperationTransaction(uo)
    // console.log(receipt)
    // ans = await smartAccountClient.account.getNonce()
    // console.log(ans, smartAccountClient.account.address)
  }

  // getUo(){
  //   const transferSolverAmount = encodeFunctionData({
  //     abi: erc20Abi,
  //     functionName: 'transfer',
  //     args: ['0x3A322Ff8ef24592e5e50D2EB4E630cDA87Bd83A6' as Hex, BigInt(10)],
  //   })

  //   return [
  //     {
  //       target: '0xd3F4Bef596a04e2be4fbeB17Dd70f02F717c5a6c' as Hex,
  //       data: transferSolverAmount,
  //     },
  //   ]
  // }
}
