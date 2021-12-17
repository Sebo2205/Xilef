const { MessageEmbed, MessageButton, MessageActionRow } = require("discord.js");
const { Command, RequiredArg } = require("../commands");
const { MPGame } = require("../minigames");

function getMul(stages = 0) {
    if (stages > 0) return Math.min(1 + (stages / 3), )
    else return Math.max(1 + (stages / 8), 0.25)
}
var statNames = {
    atk: "Attack",
    def: "Defense",
    spd: "Speed",
}
class Player {
    hp = 0
    game = null
    name = ""
    user = null
    level = 50
    stats = {
        hp: 100,
        atk: 100,
        def: 100,
        spd: 100,
    }
    statStages = {
        atk: 0,
        def: 0,
        spd: 0,
    }
    mana = 100
    get isReady() {
        var p = this
        return this.game.choices.some(el => el.player == p)
    }
    get atk() {
        return this.stats.atk * getMul(this.statStages.atk)
    }
    get def() {
        return this.stats.def * getMul(this.statStages.def)
    }
    get spd() {
        return this.stats.spd * getMul(this.statStages.spd)
    }
    statBoost(stat, amount) {
        if (stat == "mana") {
            var prev = this.mana
            this.mana = Math.min(Math.max(this.mana + amount, 0), 100)
            if (prev == this.mana) return
            if (amount > 0) {
                this.game.log(`${this.name}'s Mana increased!`)
            } else {
                this.game.log(`${this.name}'s Mana decreased!`)
            }
        } else {
            this.statStages[stat] = Math.max(Math.min(this.statStages[stat] + amount, 6), -6)
            if (amount > 0) {
                this.game.log(`${this.name}'s ${statNames[stat]} rose!`)
            } else {
                this.game.log(`${this.name}'s ${statNames[stat]} fell!`)
            }
        }
    }
    takeDamage(dmg = 0) {
        if (this.hp <= 0) return
        this.hp = Math.max(Math.min(this.hp - dmg, this.stats.hp), 0)
        if (this.hp <= 0) {
            this.game.log(`${this.name} Died`)
        }
    }
    constructor(game, user) {
        this.game = game
        this.user = user
        this.name = user.username
        this.hp = this.stats.hp
    }
}
class Choice {
    /**
     * @type {PvPGame}
     */
    game = null
    type = "attack"
    move = "slash"
    /**
     * @type {Player}
     */
    player = null
    /**
     * @type {Player}
     */
    target = null
    get priority() {
        if (this.type == "attack") return Moves[this.move].priority
        return 0
    }
    constructor(game, player, target, move) {
        this.game = game
        this.player = player
        this.move = move
        this.target = target
    }
}
function calcDamage(atk, def, pow, lvl) {
    return atk/def * pow * lvl/100
}
function randomRange(min, max) {
    return min + (Math.random() * (max - min))
}
function bar(v, max, w) {
    var c = 0
    var fill = "█"
    var bg = " "
    var str = ""
    var chars = Math.min((v / max) * w, w)
    while (c < chars) {
        var f = fill
        var mod = Math.min(chars - c, 1)
        if (mod < 1)   f = "▉"
        if (mod < 7/8) f = "▊"
        if (mod < 3/4) f = "▋"
        if (mod < 5/8) f = "▌"
        if (mod < 1/2) f = "▍"
        if (mod < 3/8) f = "▎"
        if (mod < 1/4) f = "▏"
        c++
        str += f
    }
    while (c < w) {
        c++
        str += bg
    }
    return str
}
class PvPGame {
    help = ""
    /**
     * @type {Player[]}
     */
    players = []
    /**
     * @type {Choice[]}
     */
    choices = []
    addChoice(choice) {
        if (this.choices.some(el => el.player == choice.player)) return
        if (!choice.player.user.bot) {
            for (var p of this.players) {
                if (p.user.bot) {
                    var targets = this.players.filter(el => el.user.id != p.user.id)
                    var target = targets[Math.floor(Math.random() * targets.length)]
                    this.addChoice(new Choice(this, p, target, "slash"))
                }
            }
        }
        this.choices.push(choice)
        if (this.players.every(el => el.isReady)) {
            this.doChoices()
        }
    }
    /**
     * 
     * @param {Choice} choice 
     */
    doChoice(choice) {
        if (choice.type == "attack") {
            var move = Moves[choice.move]
            this.log(`${choice.player.name} Used ${move.name}!`)
            if (Math.random() > move.accuracy/100) return this.log(`It missed...`)
            if (choice.player.mana < move.manaCost) return this.log(`Not enough mana`)
            choice.player.mana -= move.manaCost
            if (move.power > 0) {
                var atk = choice.player.atk
                var def = choice.target.def
                var pow = move.getPower(choice.player, choice.target)
                var dmg = Math.floor(calcDamage(atk, def, pow, choice.player.level), randomRange(0.85, 1))
                choice.target.takeDamage(dmg)
                if (move.lifesteal) {
                    choice.player.hp += Math.ceil(dmg * move.lifesteal)
                }
            }
            for (var stat of move.userStats) {
                if (Math.random() < stat.chance) {
                    choice.player.statBoost(stat.stat, stat.value)
                }
            }
            for (var stat of move.targetStats) {
                if (Math.random() < stat.chance) {
                    choice.target.statBoost(stat.stat, stat.value)
                }
            }
            
        }
    }
    doChoices() {
        this.logs = []
        var sorted = this.choices.sort((a, b) => Math.random() - 0.5)
        .sort((a, b) => b.player.spd - a.player.spd)
        .sort((a, b) => b.priority - a.priority)
        for (var choice of sorted) {
            if (choice.player.hp <= 0) continue
            choice.player.mana += 15
            this.doChoice(choice)
        }
        var winner = this.players.find(el => el.hp > 0)
        if (this.players.every(el => el.hp <= 0 || el == winner)) {
            if (!winner) this.log(`It was a tie!`)
            else this.log(`${winner.name} Won!`)
            this.ended = true
            PvP.leaveGame(this.host)
        } else {
            this.choices = []
        }
        if (this.message) this.sendOptions(this.message)
    }
    logs = []
    log(string = "") {
        this.logs.push(string)
    }
    prevoptions = null
    sendOptions(message) {
        var components = []
        var buttons = Object.keys(Moves).map(el => {
            return new MessageButton({ label: Moves[el].name, customId: el, style: "PRIMARY" })
        })
        buttons.push(new MessageButton({
            label: "Info",
            customId: "info",
            style: "SECONDARY"
        }))
        for (var i = 0; i < buttons.length; i++) {
            var h = Math.floor(i / 5)
            if (!components[h]) components[h] = new MessageActionRow()
            components[h].addComponents(buttons[i])
        }
        if (this.prevoptions && !this.prevoptions.deleted) this.prevoptions.delete()
        var pvp = this
        message.channel.send({components: components, embeds: [new MessageEmbed().setTitle(`${this.hostname} vs ${this.joinername}`)
        .setDescription(`${this.players.map(el => `${el.name}\n\`[${bar(el.hp, el.stats.hp, 15)}]\``).join("\n\n")}`)
        .addField("Log", `\`\`\`\n${pvp.logs.slice(-10).join("\n")}\n\`\`\``)]}).then(msg => {
        pvp.prevoptions = msg
        msg.createMessageComponentCollector({
            filter: (i) => {
                if (i.user.id != pvp.host && i.user.id != pvp.joiner) return void i.reply({
                    ephemeral: true,
                    content: `no`
                })
                return true
            },
            time: 1000 * 120
        }).on("collect", (i) => {
            var player = pvp.players.find(el => el.user.id == i.user.id)
            if (i.customId == "info") {
                return i.reply({
                    ephemeral: true,
                    embeds: [{
                        title: "Info moment",
                        description: 
                        `HP \`[${bar(player.hp, player.stats.hp, 10)}]\` ${player.hp}/${player.stats.hp}` + `\n` +
                        `MANA: \`[${bar(player.mana, 100, 10)}]\` ${player.mana}`                         + `\n` +
                        `ATK: ${player.stats.atk} (${getMul(player.statStages.atk).toFixed(2)}x)`         + `\n` + 
                        `DEF: ${player.stats.def} (${getMul(player.statStages.def).toFixed(2)}x)`         + `\n` + 
                        `SPD: ${player.stats.spd} (${getMul(player.statStages.spd).toFixed(2)}x)`
                    }]
                })
            }
            var target = pvp.players.find(el => el.user.id != i.user.id)
            var move = i.customId
            if (Moves[move].manaCost > player.mana) return i.reply({
                ephemeral: true,
                content: `You don't have enough mana to use this move`
            })
            pvp.addChoice(new Choice(pvp, player, target, move))
            i.deferUpdate()
        })
    })
    }
}
class Move {
    name = ""
    power = 0
    manaCost = 0
    accuracy = 100
    userStats = []
    priority = 0
    targetStats = []
    lifesteal = 0
    getPower(user, target) {
        return this.power
    }
    constructor(name, power, accuracy = 100, manaCost = 0) {
        this.name = name
        this.power = power
        this.accuracy = accuracy
        this.manaCost = manaCost
    }
    set(func) {
        func(this)
        return this
    }
}

Moves = {
    slash: new Move("Slash", 40, 100),
    fire: new Move("Fire", 30, 100, 25).set(el => {
        el.targetStats = [{ chance: 1, stat: "def", value: -1 }]
    }),
    ice: new Move("Ice", 55, 100, 50).set(el => {
        el.targetStats = [{ chance: 1, stat: "mana", value: -45 }]
    }),
    thunder: new Move("Thunder", 100, 30, 100).set(el => {
        el.targetStats = [{chance: 0.4, stat: "spd", value: -1}]
    })
}

PvP = new MPGame((message) => {
    PvP.hosts[message.author.id] = new PvPGame()
    return PvP.hosts[message.author.id]
})

const BOT_TEST = true
Commands.pvp = new Command(PvP.help, async(message, args) => {
    args[0] = args[0].toLowerCase()
    try {
        switch (args[0]) {
            case "host": {
                PvP.makeGame(message)
                const PvPGame = PvP.getGame(message.author.id)[0]
                PvPGame.players.push(new Player(PvPGame, message.author))
                if (BOT_TEST) {                
                    var msg = await message.channel.send(`${message.author}`)
                    PvP.connectGame(msg)
                    PvPGame.message = message
                    PvPGame.players.push(new Player(PvPGame, msg.author))
                    PvPGame.sendOptions(message)
                }
                break
            }
            case "join": {
                PvP.connectGame(message)
                const PvPGame = PvP.getGame(message.author.id)[0]
                PvPGame.message = message
                PvPGame.players.push(new Player(PvPGame, message.author))
                PvPGame.sendOptions(message)
                break
            }
            case "quit": {
                const PvPGame = PvP.getGame(message.author.id)[0]
                PvPGame.hostchoice = undefined
                PvPGame.joinerchoice = undefined
                message.channel.send(PvP.leaveGame(message.author.id))
                break
            }
            case "moves": {
                const PvPGame = PvP.getGame(message.author.id)[0]
                PvPGame.message = message
                PvPGame.sendOptions(message)
                break;
            }
            //case "moves": {
            //    const RoshamboGame = PvP.getGame(message.author.id)[0]
            //    RoshamboGame.message = message
            //    RoshamboGame.sendOptions(message)
            //    break
            //}
            default: {
                message.channel.send(PvP.help.replace(/\&/g, Prefix.get(message.guild.id)))
                return
            }
        }
    } catch (er) {
        console.error(er)
        message.reply(`no`)
    }
}, "Game", [new RequiredArg(0, PvP.help, "command"), new RequiredArg(1, undefined, "@user", true)], "https://www.youtube.com/watch?v=dQw4w9WgXcQ")