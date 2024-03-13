import { SuiNetwork } from "@sentio/sdk/sui";
import { normalizeSuiAddress } from "@mysten/sui.js/utils";
import { bls_settler, events  } from "./types/sui/unihouse.js";
import { single_deck_blackjack } from "./types/sui/blackjack.js";

type BetResult = {
  game_type: string;
  game_data: any;
  bet_id: string;
  player: string;
  bet_size: number;
  payout_amount: number;
  player_won: boolean;
  pnl: number;
};  


bls_settler
  .bind({ network: SuiNetwork.TEST_NET, startCheckpoint: BigInt(24239854) })
  .onEventSettlementEvent((event, ctx) => {
    const coin_type =
      parse_token(event.type_arguments[0]) === "COIN"
        ? "USDC"
        : parse_token(event.type_arguments[0]);
    const game_type = extractGameTypes(event.type)[0]
    const bet_id = event.data_decoded.bet_id;
    const outcome = event.data_decoded.outcome; 
    const player = normalizeSuiAddress(event.data_decoded.player);
    const bet_size = event.data_decoded.settlements[0].bet_size.scaleDown(
      token_decimal(coin_type));
    const payout_amount = event.data_decoded.settlements[0].payout_amount
    const player_won = event.data_decoded.settlements[0].player_won
    const win_condition = event.data_decoded.settlements[0].win_condition.vec[0]

    ctx.meter.Counter(`${game_type}_Games_Played`).add(1, {
      coin_type: coin_type,
    })
    ctx.meter.Counter("Total_Games_Played").add(1, {
      coin_type: coin_type,
    });
    ctx.meter.Counter("Cumulative_Bet_Size").add(Number(bet_size), {
      coin_type: coin_type,
    });
    ctx.meter.Counter("Cumulative_Payout_Amount").add(Number(payout_amount), {
      coin_type: coin_type
    })

    ctx.eventLogger.emit(`${game_type}_Bet_Result`, {
      game_type: game_type,
      game_data: {
        win_condition: win_condition, 
        outcome: outcome
      },
      bet_id: bet_id,
      player: player,
      bet_size: Number(bet_size),
      payout_amount: Number(payout_amount),
      player_won: player_won as boolean,
      pnl: player_won
      ? Number(bet_size) - Number(payout_amount)
      : Number(bet_size)
    } as BetResult);
  });

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
    
single_deck_blackjack
  .bind({ network: SuiNetwork.TEST_NET, startCheckpoint: BigInt(24239854) })
  .onEventGameOutcome((event, ctx) => {
    const coin_type = parse_token(event.type_arguments[0]);
    // Boolean on amount comparator here
    const is_win = event.data_decoded.player_won > event.data_decoded.player_lost;
    const game_type = "blackjack";
    // Case for DOUBLE and SPLIT hands
    let bet_size = BigInt(0);
    for ( let i = 0; i < event.data_decoded.player_hands.length; i++) {
      ctx.meter.Counter("Total_Blackjack_Hands").add(1, {
        coin_type: coin_type,
      });
      let hand = event.data_decoded.player_hands[i];
      if (hand.is_doubled) {
        bet_size += event.data_decoded.bet_size * BigInt(2);
      } else {
        bet_size += event.data_decoded.bet_size;
      }
    };
    const payout_amount = event.data_decoded.player_won;
    const player = event.data_decoded.player;
    const pnl = event.data_decoded.player_won - event.data_decoded.player_lost;

    ctx.eventLogger.emit(`${coin_type}_Bet_Result`, {
      game_type: game_type,
      // Note: We can modify this to add more if we want
      game_data: {
        dealer_cards: event.data_decoded.dealer_cards,
      },
      bet_id: event.data_decoded.game_id,
      player: event.data_decoded.player,
      bet_size: Number(bet_size),
      payout_amount: Number(payout_amount),
      player_won: pnl > 0,
      pnl: Number(pnl)
    } as BetResult);
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

function extractGameTypes(typeName: string): string[] {
    const x = typeName.split("<");
    if (x.length > 1) {
      const y = x[1].split("::")
      return y[y.length - 1].replace(">", "")
    } else {
      return [];
    };
  }
