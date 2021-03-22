/* globals window */

/**
 * October CMS JSON parser module.
 *
 * @copyright 2016-2021 Alexey Bobkov, Samuel Georges, Luke Towers
 * @author Ben Thomson <git@alfreido.com>
 * @link https://octobercms.com
 */

if (!window.october) {
    throw new Error('The OctoberCMS framework base must be loaded before the JsonParser module can be registered.')
}

(function (october) {
    'use strict';

    var JsonParser = function () {
    }

    JsonParser.prototype.singleton = true

    JsonParser.prototype.parse = function (str) {
        var jsonString = this.parseString(str)
        return JSON.parse(jsonString)
    }

    JsonParser.prototype.parseString = function (str) {
        str = str.trim()

        if (!str.length) {
            throw new Error('Broken JSON object.')
        }

        var result = '',
            type = null,
            key = null,
            body = ''

        /*
         * the mistake ','
         */
        while (str && str[0] === ',') {
            str = str.substr(1)
        }

        /*
         * string
         */
        if (str[0] === '"' || str[0] === '\'') {
            if (str[str.length - 1] !== str[0]) {
                throw new Error('Invalid string JSON object.')
            }

            body = '"'
            for (var i = 1; i < str.length; i++) {
                if (str[i] === '\\') {
                    if (str[i + 1] === '\'') {
                        body += str[i + 1]
                    } else {
                        body += str[i]
                        body += str[i + 1]
                    }
                    i++
                } else if (str[i] === str[0]) {
                    body += '"'
                    return body
                } else if (str[i] === '"') {
                    body += '\\"'
                } else {
                    body += str[i]
                }
            }

            throw new Error('Invalid string JSON object.')
        }

        /*
         * boolean
         */
        if (str === 'true' || str === 'false') {
            return str
        }

        /*
         * null
         */
        if (str === 'null') {
            return 'null'
        }

        /*
         * number
         */
        var num = parseFloat(str)
        if (!isNaN(num)) {
            return num.toString()
        }

        /*
         * object
         */
        if (str[0] === '{') {
            type = 'needKey'
            key = null
            result = '{'

            for (var i = 1; i < str.length; i++) {
                if (this.isBlankChar(str[i])) {
                    continue
                } else if (type === 'needKey' && (str[i] === '"' || str[i] === '\'')) {
                    key = this.parseKey(str, i + 1, str[i])
                    result += '"' + key + '"'
                    i += key.length
                    i += 1
                    type = 'afterKey'
                } else if (type === 'needKey' && this.canBeKeyHead(str[i])) {
                    key = this.parseKey(str, i)
                    result += '"'
                    result += key
                    result += '"'
                    i += key.length - 1
                    type = 'afterKey'
                } else if (type === 'afterKey' && str[i] === ':') {
                    result += ':'
                    type = ':'
                } else if (type === ':') {
                    body = this.getBody(str, i)

                    i = i + body.originLength - 1
                    result += this.parseString(body.body)

                    type = 'afterBody'
                } else if (type === 'afterBody' || type === 'needKey') {
                    var last = i
                    while (str[last] === ',' || this.isBlankChar(str[last])) {
                        last++
                    }
                    if (str[last] === '}' && last === str.length - 1) {
                        while (result[result.length - 1] === ',') {
                            result = result.substr(0, result.length - 1)
                        }
                        result += '}'
                        return result
                    } else if (last !== i && result !== '{') {
                        result += ','
                        type = 'needKey'
                        i = last - 1
                    }
                }
            }
            throw new Error('Broken JSON object near ' + result)
        }

        /*
         * array
         */
        if (str[0] === '[') {
            result = '['
            type = 'needBody'
            for (var i = 1; i < str.length; i++) {
                if (' ' === str[i] || '\n' === str[i] || '\t' === str[i]) {
                    continue
                } else if (type === 'needBody') {
                    if (str[i] === ',') {
                        result += 'null,'
                        continue
                    }
                    if (str[i] === ']' && i === str.length - 1) {
                        if (result[result.length - 1] === ",") {
                            result = result.substr(0, result.length - 1)
                        }
                        result += ']'
                        return result
                    }

                    body = this.getBody(str, i)

                    i = i + body.originLength - 1
                    result += this.parseString(body.body)

                    type = 'afterBody'
                } else if (type === 'afterBody') {
                    if (str[i] === ',') {
                        result += ','
                        type = 'needBody'

                        // deal with mistake ","
                        while (str[i + 1] === ',' || this.isBlankChar(str[i + 1])) {
                            if (str[i + 1] === ',') {
                                result += 'null,'
                            }
                            i++
                        }
                    } else if (str[i] === ']' && i === str.length - 1) {
                        result += ']'
                        return result
                    }
                }
            }
            throw new Error('Broken JSON array near ' + result)
        }
    }

    JsonParser.prototype.parseKey = function (str, pos, quote) {
        var key = ''

        for (var i = pos; i < str.length; i++) {
            if (quote && quote === str[i]) {
                return key
            } else if (!quote && (str[i] === ' ' || str[i] === ':')) {
                return key
            }

            key += str[i]

            if (str[i] === '\\' && i + 1 < str.length) {
                key += str[i + 1]
                i++
            }
        }

        throw new Error('Broken JSON syntax near ' + key)
    }

    JsonParser.prototype.getBody = function (str, pos) {
        var body = ''

        // parse string body
        if (str[pos] === '"' || str[pos] === '\'') {
            body = str[pos]

            for (var i = pos + 1; i < str.length; i++) {
                if (str[i] === '\\') {
                    body += str[i]
                    if (i + 1 < str.length) {
                        body += str[i + 1]
                    }
                    i++
                } else if (str[i] === str[pos]) {
                    body += str[pos]
                    return {
                        originLength: body.length,
                        body: body,
                    }
                } else {
                    body += str[i]
                }
            }

            throw new Error('Broken JSON string body near ' + body)
        }

        // parse true / false
        if (str[pos] === 't') {
            if (str.indexOf('true', pos) === pos) {
                return {
                    originLength: 'true'.length,
                    body: 'true',
                }
            }

            throw new Error('Broken JSON boolean body near ' + str.substr(0, pos + 10))
        }
        if (str[pos] === 'f') {
            if (str.indexOf('f', pos) === pos) {
                return {
                    originLength: 'false'.length,
                    body: 'false',
                }
            }

            throw new Error('Broken JSON boolean body near ' + str.substr(0, pos + 10))
        }

        // parse null
        if (str[pos] === 'n') {
            if (str.indexOf('null', pos) === pos) {
                return {
                    originLength: 'null'.length,
                    body: 'null',
                }
            }
            throw new Error('Broken JSON boolean body near ' + str.substr(0, pos + 10))
        }

        // parse number
        if (str[pos] === '-' || str[pos] === '+' || str[pos] === '.' || (str[pos] >= '0' && str[pos] <= '9')) {
            body = ''

            for (var i = pos; i < str.length; i++) {
                if (str[i] === '-' || str[i] === '+' || str[i] === '.' || (str[i] >= '0' && str[i] <= '9')) {
                    body += str[i]
                } else {
                    return {
                        originLength: body.length,
                        body: body,
                    }
                }
            }

            throw new Error('Broken JSON number body near ' + body)
        }

        // parse object
        if (str[pos] === '{' || str[pos] === '[') {
            var stack = [str[pos],]
            body = str[pos]

            for (var i = pos + 1; i < str.length; i++) {
                body += str[i]
                if (str[i] === '\\') {
                    if (i + 1 < str.length) {
                        body += str[i + 1]
                    }
                    i++
                } else if (str[i] === '"') {
                    if (stack[stack.length - 1] === '"') {
                        stack.pop()
                    } else if (stack[stack.length - 1] !== '\'') {
                        stack.push(str[i])
                    }
                } else if (str[i] === '\'') {
                    if (stack[stack.length - 1] === '\'') {
                        stack.pop()
                    } else if (stack[stack.length - 1] !== '"') {
                        stack.push(str[i])
                    }
                } else if (stack[stack.length - 1] !== '"' && stack[stack.length - 1] !== '\'') {
                    if (str[i] === '{') {
                        stack.push('{')
                    } else if (str[i] === '}') {
                        if (stack[stack.length - 1] === '{') {
                            stack.pop()
                        } else {
                            throw new Error('Broken JSON ' + (str[pos] === '{' ? 'object' : 'array') + ' body near ' + body)
                        }
                    } else if (str[i] === '[') {
                        stack.push('[')
                    } else if (str[i] === ']') {
                        if (stack[stack.length - 1] === '[') {
                            stack.pop()
                        } else {
                            throw new Error('Broken JSON ' + (str[pos] === '{' ? 'object' : 'array') + ' body near ' + body)
                        }
                    }
                }
                if (!stack.length) {
                    return {
                        originLength: i - pos,
                        body: body,
                    }
                }
            }

            throw new Error('Broken JSON ' + (str[pos] === '{' ? 'object' : 'array') + ' body near ' + body)
        }

        throw new Error('Broken JSON body near ' + str.substr((pos - 5 >= 0) ? pos - 5 : 0, 50))
    }

    JsonParser.prototype.canBeKeyHead = function (ch) {
        if (ch[0] === '\\') {
            return false
        }
        if ((ch[0] >= 'a' && ch[0] <= 'z') || (ch[0] >= 'A' && ch[0] <= 'Z') || ch[0] === '_') {
            return true
        }
        if (ch[0] >= '0' && ch[0] <= '9') {
            return true
        }
        if (ch[0] === '$') {
            return true
        }
        if (ch.charCodeAt(0) > 255) {
            return true
        }
        return false
    }

    JsonParser.prototype.isBlankChar = function (ch) {
        return ch === ' ' || ch === '\n' || ch === '\t'
    }

    // Extend the October JS framework
    october.extend('JSON', JsonParser)

    // Add to global function for backwards compatibility
    window.ocJSON = function (json) {
        return october.json.parse(json)
    }
}(window.october))