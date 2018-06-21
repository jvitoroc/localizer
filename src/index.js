const jsonClient = require("json-client");
const browserLocale = require("browser-locale");

// ISO 639-1
// ISO 3166-1

const localeExpr = /(\w+)-?(\w+)?/i;

function getBrowserLocale(){
    let result = browserLocale();
    result = localeExpr.exec(result);
    let output = [result[1]];
    if(result[2])
        output.push(`${result[1]}${'-'}${result[2].toUpperCase()}`);
    return output;
}

let localizer = (function () {

    const DEFAULT_CONFIG = {
        endpoint: "/strings/",      // endpoint: where to fetch the JSONs
        ext: ".json",               // ext: extension of the resources
        default: "en",              // default: default language
        changingClass: "changing",  // changingClass: class name that will be added to the elements with the [data-localize] attribute when a translation is being loaded
        priority: 'language',       // priority(language|country): (consider pt-BR) if the priority is the 'language', then localizer will request 'pt' first, if it's not successful request 'pt-BR'. If the priority is the 'country', it will do the inverse.
        country: true               // country: should localizer request country (pt-BR)?
    }

    const storage = window.localStorage;

    function localizer(config = {}){
        this.config = Object.assign(DEFAULT_CONFIG, config);
        this.events = {};

        if(!this.config.endpoint.endsWith("/"))
            this.config.endpoint = "/";

        this.fetcher = jsonClient(this.config.endpoint);
    }
    
    localizer.prototype._callEvent = function(eventName, data){
        let events = this.events;
        if(!events.hasOwnProperty(eventName))
            return;
        events[eventName].forEach((cb)=>{
            if(eventName == "changestart" || eventName == "changeend")
                // (fromLang, toLang)
                cb.call(null, this.config.currentLang, data.lang);
            if(eventName == "initialstart" || eventName == "initialend")
                // (lang)
                cb.call(null, this.config.currentLang);
        });
    }

    localizer.prototype.init = function(){
        this._callEvent('initialstart');
        this._localize();
        this._callEvent('initialend');
    }

    localizer.prototype._fetch = async function(resource){
        return await this._fetcher('get', `${this.config.endpoint}${resource}${this.config.ext}`);
    }

    localizer.prototype._populate = function (data){
        let els = document.querySelectorAll('[data-localize]');
        els.forEach((e)=>{
            let tick = e.getAttribute("data-localize");
            let levels = tick.split(".");
            var translation = data;
            
            levels.forEach((e)=>{
                translation = translation[e];
            });

            if(typeof translation !== "string" && typeof translation !== "number"){
                console.warn(`[data-localize=${tick}] translation is not a string or number`)
            }
            e.textContent = translation;
        });
    }

    localizer.prototype._fetchFirst = async function(resources){
        let data = null;
        for(let i = 0; i < resources.length; i++){
            try{
                data = await this._fetch(rsc);
                break;
            }catch(e){continue;}
        }
        if(data)
            throw new Error("An error occurred when trying to fetch the data");
        return data;
    }

    localizer.prototype._localize = async function(){
        let data;
        let resources = [];
        let chacedLang = storage.getItem("localizer_lang");
        if(!chacedLang){
            const locale = getBrowserLocale();
            switch(this.config.priority){
                case "country":
                    if(locale[1])
                        resources.push(locale[1]);
                    resources.push(locale[0]);
                break;

                case "language":
                default:
                    resources.push(locale[0]);
                    if(this.config.country && locale[1])
                        resources.push(locale[1]);
                break;
            }
        }
        else
            resources.push(chacedLang);
        resources.push(this.config.default);
        data = await this._fetchFirst(resources);
        this._populate(data);
    }

    localizer.prototype.on = function(event, callback){
        if(!events[event].hasOwnProperty(event))
            events[event] = [];
        events[event].push(callback);
    }
    
    localizer.prototype.change = function(lang){
        this._callEvent('changestart', {lang});
        storage.setItem("localizer_lang", lang);
        
        this._localize();

        this._callEvent('changeend', {lang});
    }

    return localizer;
})();

var a = new localizer();