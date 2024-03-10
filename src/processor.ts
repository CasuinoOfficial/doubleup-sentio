import { SuiNetwork } from "@sentio/sdk/sui";
import { bls_settler, events  } from "./types/sui/unihouse.js";

// bls_settler
//   .bind({ network: SuiNetwork.TEST_NET, startCheckpoint: BigInt(24239854) })
//   .onEventSettlement((event, ctx) => {

    
//   })



events 
  .bind({ network: SuiNetwork.TEST_NET, startCheckpoint: BigInt(24239854) })
  .onEventDeposit((event, ctx) => {
    const coin_type = parse_token(event.type_arguments[0]);
    const amount = event.data_decoded.amount.scaleDown(
      token_decimal(coin_type)
      );
      ctx.meter.Counter("Total_Deposit").add(Number(amount), {
        coin_type: coin_type,
      });
      ctx.eventLogger.emit(`${coin_type}_Deposit`, {
        amount: amount,
      })
    })
  .onEventWithdraw((event, ctx) => {
    const coin_type = parse_token(event.type_arguments[0]);
    const amount = event.data_decoded.amount.scaleDown(
      token_decimal(coin_type)
    );
    ctx.meter.Counter("Total_Withdraw").add(amount, {
      coin_type: coin_type,
    });
    ctx.eventLogger.emit(`${coin_type}_Withdraw`, {
      amount: amount,
    });
  });
    

  



function parse_token(name: string): string {
  let typeArgs = name.split("::");
  return typeArgs[2];
}

function token_decimal(token: string): number {
  switch (token) {
    case "SUI":
      return 9;
    case "BUCK":
      return 9;
    case "CETUS":
      return 9;
    case "USDC":
      return 6;
    default:
      return 9;
  }
}