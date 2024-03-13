import { SuiNetwork } from "@sentio/sdk/sui";
import { normalizeSuiAddress } from "@mysten/sui.js/utils";
import { bls_settler, events  } from "./types/sui/unihouse.js";
import { single_deck_blackjack } from "./types/sui/blackjack.js";
import { plinko } from "./types/sui/plinko.js";
import { roulette_events } from "./types/sui/roulette.js";
import { limbo } from "./types/sui/limbo.js";

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

const ROULETTE_BET_TYPES = [
  { name: "RED_BET", odds: 2 },
  { name: "BLACK_BET", odds: 2 },
  { name: "NUMBER_BET", odds: 36 },
  { name: "EVEN_BET", odds: 2 },
  { name: "ODD_BET", odds: 2 },
  { name: "FIRST_TWELVE", odds: 3 },
  { name: "SECOND_TWELVE", odds: 3 },
  { name: "THIRD_TWELVE", odds: 3 },
  { name: "FIRST_EIGHTEEN", odds: 2 },
  { name: "SECOND_EIGHTEEN", odds: 2 },
  { name: "FIRST_COLUMN", odds: 3 },
  { name: "SECOND_COLUMN", odds: 3 },
  { name: "THIRD_COLUMN", odds: 3 },
];

const DICE_BET_TYPES = [
  { num: 0, type: "small", odds: 2 },
  { num: 1, type: "1", odds: 5.5 },
  { num: 2, type: "2", odds: 5.5 },
  { num: 3, type: "3", odds: 5.5 },
  { num: 4, type: "4", odds: 5.5 },
  { num: 5, type: "5", odds: 5.5 },
  { num: 6, type: "6", odds: 5.5 },
  { num: 7, type: "odd", odds: 2 },
  { num: 8, type: "even", odds: 2 },
  { num: 9, type: "big", odds: 2 },
];

bls_settler
  .bind({ network: SuiNetwork.TEST_NET, startCheckpoint: BigInt(24239854) })
  .onEventSettlementEvent((event, ctx) => {
    const coin_type =
      parse_token(event.type_arguments[0]) === "COIN"
        ? "USDC"
        : parse_token(event.type_arguments[0]);
        // 1 is the actual game type
    const game_type = extractGameTypes(event.type)
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

    ctx.eventLogger.emit(`${coin_type}_Bet_Result`, {
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
    
roulette_events
  .bind({ network: SuiNetwork.TEST_NET, startCheckpoint: BigInt(24239854) })
  .onEventGameSettlement((event, ctx) => {
    const coin_type =
      parse_token(event.type_arguments[0]) === "COIN"
        ? "USDC"
        : parse_token(event.type_arguments[0]);
        let bet_results = event.data_decoded.bet_results;
        for (let i = 0; i< bet_results.length; i++) {
          let bet = bet_results[i];
          const bet_type = bet.bet_type;
          const bet_number = bet.bet_number;
          const bet_size = bet.bet_size.scaleDown(
            token_decimal(coin_type)
          );
          const player = normalizeSuiAddress(bet.player);
          const player_win = bet.is_win;
      
          ctx.meter.Counter("Total_Bets").add(1, {
            coin_type: coin_type,
          });
          ctx.meter.Counter("Cumulative_Bet_Size").add(Number(bet_size), {
            coin_type: coin_type,
          });
          ctx.eventLogger.emit(`${coin_type}_Bet_Result`, {
            player: player,
            bet_type: ROULETTE_BET_TYPES[bet_type].name,
            bet_number: `${bet_number}`,
            bet_size: bet.bet_size,
            player_win: player_win,
            pnl: player_win
              ? Number(bet_size) * ROULETTE_BET_TYPES[bet_type].odds -
                Number(bet_size)
              : -Number(bet_size),
          });
        }
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

  limbo
  .bind({ network: SuiNetwork.TEST_NET, startCheckpoint: BigInt(24239854) })
  .onEventLimboResults((event, ctx) => {
    const coin_type = parse_token(event.type_arguments[0]);
    let results = event.data_decoded.results;
    for (let i = 0; i < results.length; i++) {
      let result = results[i];
      let pnl = result.bet_returned - result.bet_size;
      ctx.eventLogger.emit(`${coin_type}_Bet_Result`, {
        game_type: "limbo",
        // Note: We can modify this to add more if we want
        game_data: {
          outcome: result.outcome,
        },
        player: event.data_decoded.player,
        bet_size: Number(result.bet_size),
        payout_amount: Number(result.bet_returned),
        player_won: pnl > 0,
        pnl: Number(pnl)
      });
    }
  });

  plinko
  .bind({ network: SuiNetwork.TEST_NET, startCheckpoint: BigInt(24239854) })
  .onEventOutcome((event, ctx) => {
    const coin_type = parse_token(event.type_arguments[0]);
    ctx.eventLogger.emit(`${coin_type}_Bet_Result`, {
      game_type: "plinko",
      // Note: We can modify this to add more if we want
      game_data: {
        ball_count: event.data_decoded.ball_count,
        ///    const LOW_GAME_TYPE: u8 = 0;
    ///const MID_GAME_TYPE: u8 = 1;
    ///const HIGH_GAME_TYPE: u8 = 2;
        game_type: event.data_decoded.game_type
      },
      player: event.data_decoded.player,
      bet_size: Number(event.data_decoded.bet_size),
      payout_amount: Number(event.data_decoded.pnl),
      player_won: event.data_decoded.pnl > event.data_decoded.bet_size,
      pnl: Number(event.data_decoded.pnl - event.data_decoded.bet_size)
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

function extractGameTypes(typeName: string): string {
    const x = typeName.split("<");
    if (x.length > 1) {
      const y = x[1].split("::")
      return y[y.length - 1].replace(">", "")
    } else {
      return "";
    };
  }
