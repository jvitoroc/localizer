const browserLocale = require("browser-locale");
const jsonClient = require('jsonClient').default;

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

function dotObject(notation, obj){
    let levels = notation.split(".");
    try{
        levels.forEach((e)=>{
            obj = obj[e];
        });
        return obj;
    }catch(e){
        return undefined;
    }
}

let localizer = (function () {

    const DEFAULT_CONFIG = {
        qs: "lang",                 // qs: key name of the query string param indicating the language of the page (high priority).
        scope: document,            // scope: limit the search for localizable elements to only elements inside the scope.
        endpoint: "/strings/",      // endpoint: where to fetch the resources (translations).
        ext: ".json",               // ext: extension of the resources.
        default: "en",              // default: default language.
        changingClass: "changing",  // changingClass: class name what will be added to the <html> element when a resource is being loaded.
        priority: 'language',       // priority(language|country): (consider pt-BR) if the priority is the 'language', then localizer will request 'pt' first, if the request fails, request 'pt-BR'. If the priority is the 'country', it will do the opposite.
        country: true,              // country: should localizer request country (pt-BR)?
        defaultHardcoded: false     // defaultHardcoded: if true, the hardcoded strings (HTML) are the default, localizer won't download the default JSON.
    }

    function localizer(config = {}){
        this.config = Object.assign(DEFAULT_CONFIG, config);
        this.events = {};

        if(!this.config.endpoint.endsWith("/"))
            this.config.endpoint = "/";
        
        this._fetcher = jsonClient(this.config.endpoint);
    }
    
    localizer.prototype._callEvent = function(eventName, data){
        let events = this.events;
        if(!events.hasOwnProperty(eventName))
            return;
        events[eventName].call(null, data)
    }

    localizer.prototype.init = function(){
        this._callEvent('initialstart');
        let search = window.location.search;
        let highPriority = undefined;

        if(search !== ''){
            let parsedQs = new URLSearchParams(search.substring(1));
            let qs = this.config.qs;
            if(parsedQs.has(qs))
                highPriority = parsedQs.get(qs);
        }

        this._localize(highPriority);
        this._callEvent('initialend');
    }

    localizer.prototype._fetch = async function(resource){
        return await this._fetcher('get', `${this.config.endpoint}${resource}${this.config.ext}`);
    }

    localizer.prototype._populate = function (data){
        let els = document.querySelectorAll('[data-localize]');
        els.forEach(async (e)=>{
            let tick = e.getAttribute("data-localize");

            let translation = dotObject(tick, data)

            if(typeof translation !== "string" && typeof translation !== "number"){
                console.warn(`[data-localize=${tick}] translation is not a string or number`)
            }

            if(translation === undefined || translation === null){
                if(!this.config.defaultHardcoded){
                    try{
                        let defaultData = await this._fetch(this.config.default);
                        translation = dotObject(tick, defaultData);
                        if(translation !== undefined && translation !== null){
                            e.textContent = translation;
                        }
                    }catch(e){}
                }
            }
            e.textContent = translation;
        });
    }

    localizer.prototype._fetchFirst = async function(resources){
        let data = null;
        for(let i = 0; i < resources.length; i++){
            try{
                data = await this._fetch(resources[i]);
                break;
            }catch(e){
                continue;
            }
        }
        if(data === null)
            throw new Error(404);
        return data;
    }

    localizer.prototype._localize = async function(highPriority = undefined){
        let resources = [];
        const locale = getBrowserLocale();
        if(highPriority !== undefined)
            resources.push(highPriority);
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
        }

        if(!this.config.defaultHardcoded)
            resources.push(this.config.default);

        try{
            let data = await this._fetchFirst(resources);
            this._populate(data);
        }catch(e){
            console.error(e);
        }
        
    }

    localizer.prototype.on = function(event, callback){
        this.events[event] = callback;
    }
    
    localizer.prototype.change = function(lang){
        this._callEvent('changestart', {lang});
        changingClass = this.config.changingClass;
        this.documentElement.classList.add(changingClass);
        
        this._localize();

        this.documentElement.classList.remove(changingClass);
        this._callEvent('changeend', {lang});
    }

    return localizer;
})();

var a = new localizer();
a.init();