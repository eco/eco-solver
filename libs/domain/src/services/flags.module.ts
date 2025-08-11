@Module({
  imports: [TransactionModule],
  providers: [FlagService],
  exports: [FlagService],
})
export class FlagsModule {}
