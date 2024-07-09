curl -L -X POST 'https://fullnode.mainnet.sui.io/' -H 'Content-Type: application/json' --data-raw '{ "jsonrpc": "2.0", "id": 1, "method": "sui_getNormalizedMoveModulesByPackage", "params": [ "0x80fe74322a141e1a4de653c7ed7f8341c457fb91c7415347ba5475cda8c40faf" ] }'

npx sentio gen

# To upload
npx sentio upload

Packages that emit events:

Limbo: 0xbca3313d753bba2e3b3d911d2306c5024de99dfdb2fc456850186b18867ac36c
Blackjack: 0xbdec0470a0b3c4a1cd3d2ac3b7eb10af57db23e2dffcdf001f1f04f6eb79e065
Plinko: 0x1513ee1a47bb1e3b78162f42510f3eece3c6ab0b246bdafda47f939cf7a81c07
Dice / Flip / -> UNIHOUSE: 0xf0978635bb456d2cb2e594cd4a018c9aed486d6cb68c7890abe5ef56838034bf
Roulette: 0x97edb657c1fc47e02b1c6603fcdf82974b149f6b9bb8e3ade69c6ec94f3003f1
PumpUp: 0x3f2a0baf78f98087a04431f848008bad050cb5f4427059fa08eeefaa94d56cca
Lottery: 0x5fad208418200537f2785aefdca3c8e15e2843ebdffd524956e6d6d6aca845a9
BlastOff: 0x80fe74322a141e1a4de653c7ed7f8341c457fb91c7415347ba5475cda8c40faf

ScratchOff:

