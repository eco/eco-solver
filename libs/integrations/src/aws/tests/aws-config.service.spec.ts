const mockConfigGet = jest.fn()

jest.mock('config', () => {
  return {
    get: mockConfigGet,
  }
})

describe('Aws Config Helper Tests', () => {
  let awsConfigService: AwsConfigService
  let mockLog: jest.Mock
  let mockAwsGet: jest.Mock
  const awsConfigSingle = { region: 'us-florida', secretID: 'secrets' }
  const awsConfigSingleData = { key: 1, value: 'value1' }
  const awsConfigArray = [awsConfigSingle, { region: 'us-california', secretID: 'configs' }]
  const awsConfigArrayData = [awsConfigSingleData, { key: 3, value_second: 'value3' }]
  beforeEach(async () => {
    const configMod: TestingModule = await Test.createTestingModule({
      providers: [AwsConfigService],
    }).compile()

    awsConfigService = configMod.get<AwsConfigService>(AwsConfigService)
    mockLog = jest.fn()
    mockAwsGet = jest.fn()
  })

  it('should read single aws credential', async () => {
    mockConfigGet.mockReturnValue(awsConfigSingle)
    awsConfigService['getAwsSecrets'] = mockAwsGet.mockResolvedValue(awsConfigSingleData)
    await awsConfigService.initConfigs()
    expect(awsConfigService.getConfig()).toEqual(awsConfigSingleData)
  })

  it('should read array of aws credentials', async () => {
    mockConfigGet.mockReturnValue(awsConfigArray)
    let index = 0
    awsConfigService['getAwsSecrets'] = mockAwsGet.mockImplementation(() => {
      return awsConfigArrayData[index++]
    })
    const me = {}
    awsConfigArrayData.forEach((data) => {
      merge(me, data)
    })
    merge({}, ...awsConfigArrayData)

    await awsConfigService.initConfigs()
    expect(awsConfigService.getConfig()).toEqual(me)
  })
})
