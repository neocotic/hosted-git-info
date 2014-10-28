"use strict"
var url = require("url")

var GitHost = exports = module.exports = function (type, user, project, comittish) {
  this.type           = type
  this.domain         = gitHosts[type].domain
  this.filetemplate   = gitHosts[type].filetemplate
  this.sshtemplate    = gitHosts[type].sshtemplate
  this.sshurltemplate = gitHosts[type].sshurltemplate
  this.browsetemplate = gitHosts[type].browsetemplate
  this.docstemplate   = gitHosts[type].docstemplate
  this.bugstemplate   = gitHosts[type].bugstemplate
  this.httpstemplate  = gitHosts[type].httpstemplate
  this.treepath       = gitHosts[type].treepath
  this.user           = user
  this.project        = project
  this.comittish      = comittish
}
GitHost.prototype = {}

exports.fromUrl = function (giturl) {
  if (giturl == null || giturl == "") return
  var parsed = parseGitUrl(giturl)
  var matches = Object.keys(gitHosts).map(function(V) {
    var gitHost = gitHosts[V]
    var comittish = parsed.hash ? decodeURIComponent(parsed.hash.substr(1)) : null
    if (parsed.protocol == V + ":") {
      return new GitHost(V,
        decodeURIComponent(parsed.host), decodeURIComponent(parsed.path.replace(/^[/](.*?)(?:[.]git)?$/, "$1")), comittish)
    }
    if (parsed.host != gitHost.domain) return
    if (! gitHost.protocols_re.test(parsed.protocol)) return
    var matched = parsed.path.match(/^[/]([^/]+)[/]([^/]+?)(?:[.]git)?$/)
    if (! matched) return
    return new GitHost(V, decodeURIComponent(matched[1]), decodeURIComponent(matched[2]), comittish)
  }).filter(function(V){ return V })
  if (matches.length != 1) return
  return matches[0]
}

var parseGitUrl = function (giturl) {
  if (typeof giturl != "string") giturl = "" + giturl
  var matched = giturl.match(/^([^@]+)@([^:]+):([^/]+[/][^/]+?)(?:[.]git)?(#.*)?$/)
  if (! matched) return url.parse(giturl)
  return {
    protocol: "git+ssh:",
    slashes: true,
    auth: matched[1],
    host: matched[2],
    port: null,
    hostname: matched[2],
    hash: matched[4],
    search: null,
    query: null,
    pathname: "/" + matched[3],
    path: "/" + matched[3],
    href: "git+ssh://" + matched[1] + "@" + matched[2] + "/" + matched[3] + (matched[4]||"")
  }
}

var gitHosts = {
  github: {
    "protocols": [ "git", "git+ssh", "git+https", "ssh", "https" ],
    "domain": "github.com",
    "treepath": "tree",
    "filetemplate": "https://raw.githubusercontent.com/{user}/{project}/{comittish}/{path}",
    "bugstemplate": "https://{domain}/{user}/{project}/issues"
  },
  bitbucket: {
    "protocols": [ "git+ssh", "git+https", "ssh", "https" ],
    "domain": "bitbucket.org",
    "treepath": "src"
  },
  gitlab: {
    "protocols": [ "git+ssh", "git+https", "ssh", "https" ],
    "domain": "gitlab.com",
    "treepath": "tree",
    "docstemplate": "https://{domain}/{user}/{project}{/tree/comittish}#README",
    "bugstemplate": "https://{domain}/{user}/{project}/issues"
  }
}

Object.keys(gitHosts).forEach(function(host) {
  gitHosts[host].protocols_re = RegExp("^(" +
    gitHosts[host].protocols.map(function(P){
      return P.replace(/([\\+*{}()\[\]$^|])/g, "\\$1")
    }).join("|") + "):$")
})

GitHost.prototype.shortcut = function () {
  return this.type + ":" + this.path()
}

GitHost.prototype.hash = function () {
  return this.comittish ? "#" + this.comittish : ""
}

GitHost.prototype.path = function () {
  return this.user + "/" + this.project + this.hash()
}

GitHost.prototype._fill = function (template, vars) {
  if (! template) throw new Error("BOOM")
  if (!vars) vars = {}
  var self = this
  Object.keys(this).forEach(function(K){ if (self[K]!=null && vars[K]==null) vars[K] = self[K] })
  var rawComittish = vars.comittish
  Object.keys(vars).forEach(function(K){ (K[0]!='#') && (vars[K] = encodeURIComponent(vars[K])) })
  vars["#comittish"] = rawComittish ? "#" + rawComittish : ""
  vars["/tree/comittish"] = vars.comittish ? "/"+vars.treepath+"/" + vars.comittish : "",
  vars["/src/comittish"] = vars.comittish ? "/src/" + vars.comittish : "",
  vars.comittish = vars.comittish || "master"
  var res = template
  Object.keys(vars).forEach(function(K){
    res = res.replace(new RegExp("[{]" + K + "[}]", "g"), vars[K])
  })
  return res
}

GitHost.prototype.ssh = function () {
  var sshtemplate = this.sshtemplate || "git@{domain}:{user}/{project}.git{#comittish}"
  return this._fill(sshtemplate)
}

GitHost.prototype.sshurl = function () {
  var sshurltemplate = this.sshurltemplate || "git+ssh://git@{domain}/{user}/{project}.git{#comittish}"
  return this._fill(sshurltemplate)
}

GitHost.prototype.browse = function () {
  var browsetemplate = this.browsetemplate || "https://{domain}/{user}/{project}{/tree/comittish}"
  return this._fill(browsetemplate)
}

GitHost.prototype.docs = function () {
  var docstemplate = this.docstemplate || "https://{domain}/{user}/{project}{/tree/comittish}#readme"
  return this._fill(docstemplate)
}

GitHost.prototype.bugs = function() {
  if (! this.bugstemplate) return
  return this._fill(this.bugstemplate)
}

GitHost.prototype.https = function () {
  var httpstemplate = this.httpstemplate || "https://{domain}/{user}/{project}.git{#comittish}"
  return this._fill(httpstemplate)
}

GitHost.prototype.file = function (P) {
  var filetemplate = this.filetemplate || "https://{domain}/{user}/{project}/raw/{comittish}/{path}"
  return this._fill(filetemplate, {
    path: P.replace(/^[/]+/g, "")
  })
}

GitHost.prototype.toString = function () {
  return this[this.default||"sshurl"]()
}
