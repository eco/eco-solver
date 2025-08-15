import { isERC20Target } from '../ERC20.contract'
const address1 = '0x1111111111111111111111111111111111111111'

describe('ERC20 contract', () => {
  describe('on isERC20Target', () => {
    it('should return false if the target data is null', async () => {
      expect(isERC20Target(null)).toBe(false)
    })

    it('should return false if the target data is not erc20', async () => {
      expect(
        isERC20Target({
          targetConfig: { contractType: 'erc721' },
        } as any),
      ).toBe(false)
    })

    it('should return false if the target selector isnt the permitted selector', async () => {
      expect(
        isERC20Target(
          {
            targetConfig: { contractType: 'erc20' },
            selector: '0x70a08231', //balanceOf
          } as any,
          '0xa123123',
        ),
      ).toBe(false)
    })

    it('should return false if the target selector is not transfer', async () => {
      expect(
        isERC20Target({
          targetConfig: { contractType: 'erc20' },
          selector: '0x70a08231', //balanceOf
        } as any),
      ).toBe(false)
    })

    it('should return false if the target selector args are incorrect', async () => {
      expect(
        isERC20Target({
          targetConfig: { contractType: 'erc20' },
          selector: '0xa9059cbb', //transfer
          decodedFunctionData: { args: [address1] },
        } as any),
      ).toBe(false)
    })

    it('should return true if the target selector and args are for erc20 transfer', async () => {
      expect(
        isERC20Target({
          targetConfig: { contractType: 'erc20' },
          selector: '0xa9059cbb', //transfer
          decodedFunctionData: { args: [address1, 100n] },
        } as any),
      ).toBe(true)
    })
  })
})
