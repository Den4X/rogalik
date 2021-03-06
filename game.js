function Game() {
    window.game = this;

    this.screen = {
        width: 1024,
        height: 768,
    };
    this.screen.cells_x = this.screen.width / CELL_SIZE;
    this.screen.cells_y = this.screen.height / CELL_SIZE;

    this.world = document.getElementById("world");
    this.world.style.width = this.screen.width + "px";
    this.world.style.height = this.screen.height + "px";

    this.canvas = document.getElementById("canvas");
    this.canvas.width = this.screen.width;
    this.canvas.height = this.screen.height;

    this.ctx = canvas.getContext("2d");
    this.ctx.clear = function() {
        game.ctx.clearRect(0, 0, game.canvas.width, game.canvas.height);
    };
    this.setFontSize = function(size) {
        this.ctx.font = (size || FONT_SIZE) + "px Philosopher";
    };
    this.setFontSize();

    this.ping = 0;
    this.time = 0;
    this.timeElement = document.getElementById("time");

    this.version = JSON.parse(localStorage.getItem("Version"));

    util.ajax("build-warning.html", function(warn) {
        if (!warn) {
            util.dom.hide(document.getElementById("build-warning"));
            return;
        }

        var panel = new Panel("build-warning-panel", "");
        panel.contents.innerHTML = warn;

        var title = document.getElementById("build-warning-title");
        var buildWarning = document.getElementById("build-warning");
        util.dom.replace(buildWarning, title);
        title.id = "build-warning";
        panel.setTitle(title.textContent);

        document.getElementById("bugreport-send").onclick = function() {
            var text = document.getElementById("bugreport-text");
            game.network.send("bugreport", {Text: text.value}, function(data) {
                if (data.Ack)
                    text.value = "";
            });
        };

        title.onclick = function() {
            panel.show();
        };
    });

    this.initTime = function(time, tick) {
        this.setTime(time);
        setInterval(function() {
            if (++time > 1440)
                time = 0;

            game.setTime(time);
        }, tick);
    };

    this.setTime = function(time) {
        if (!time)
            return;
        game.time = time;
        var hours = Math.floor(time / 60);
        var minutes = time % 60;
        if (minutes < 10)
            minutes = '0' + minutes;
        this.timeElement.textContent = hours + ":" + minutes;
    };

    this.debug = debug;
    delete window[debug];

    this.config = config;
    delete window[config];

    Settings.load();
    dict.init();

    this.talks = new Talks();
    this.sound = new Sound();

    this.offset = {
        world: this.world,
        get x() { return this.world.offsetLeft; },
        get y() { return this.world.offsetTop; },
    };

    this.loader = new Loader("assets/");
    window.loader = this.loader;

    this.menu = new Menu(
        this.offset.x + CELL_SIZE / 2,
        this.offset.y
    );

    this.login = null;
    this.player = new Character();

    this.map = new Map();

    this.controller = new Controller(this);
    this.network = new Network();

    this.entities = new HashTable();
    this.sortedEntities = new BinarySearchTree();
    this.claims = new HashTable();
    this.characters = new HashTable();
    this.containers = {};
    this.vendors = {};

    this.panels = {};
    this.epsilon = 0;
    this.camera = new Camera();

    this.drawStrokedText = function(text, x, y, strokeStyle) {
        if (game.config.ui.simpleFonts) {
            game.ctx.fillText(text, x, y);
            return;
        }
        var lineJoin = game.ctx.lineJoin;
        game.ctx.strokeStyle = strokeStyle || "#333";
        game.ctx.lineWidth = 4;
        game.ctx.lineJoin = 'round';
        game.ctx.strokeText(text, x, y);
        game.ctx.fillText(text, x, y);
        game.ctx.lineWidth = 1;
        game.ctx.lineJoin = lineJoin;
    };

    this.iso = new function() {
        var k = Math.sqrt(2);

        function draw(x, y, callback) {
            var p = new Point(x, y).toScreen();
            game.ctx.save();
            if (game.ctx.lineWidth < 2)
                game.ctx.lineWidth = 2;
            game.ctx.translate(p.x, p.y);
            game.ctx.scale(1, 0.5);
            game.ctx.rotate(Math.PI / 4);
            callback();
            game.ctx.restore();
        }
        this.strokeRect = function(x, y, w, h) {
            draw(x, y, function() {
                game.ctx.strokeRect(0, 0, w * k, h * k);
            });
        };
        this.fillRect = function(x, y, w, h) {
            draw(x, y, function() {
                game.ctx.fillRect(0, 0, w * k, h * k);
            });
        };
        this.fillCircle = function(x, y, r) {
            draw(x, y, function() {
                game.ctx.beginPath();
                game.ctx.arc(0, 0, r * k, 0, Math.PI * 2);
                game.ctx.fill();
            });
        };
        this.strokeCircle = function(x, y, r) {
            draw(x, y, function() {
                game.ctx.beginPath();
                game.ctx.arc(0, 0, r * k, 0, Math.PI * 2);
                game.ctx.stroke();
            });
        };
        this.fillStrokedCircle = function(x, y, r) {
            this.fillCircle(x, y, r);
            this.strokeCircle(x, y, r);
        };
        this.fillStrokedRect = function(x, y, w, h) {
            this.fillRect(x, y, w, h);
            this.strokeRect(x, y, w, h);
        };
    };

    this.addEventListeners = function() {
        window.addEventListener("beforeunload", function(e) {
            Panel.save();
            Container.save();
            if (game.help)
                game.help.save();
            if (config.system.quitConfirm && game.stage.name != "exit") {
                e.preventDefault();
                return T("Quit?");
            }
            return null;
        });

        window.addEventListener('focus', function() {
            game.focus = true;
        });

        window.addEventListener('blur', function() {
            game.focus = false;
        });

    };

    this.update = function(currentTime) {
        this.stage.update(currentTime);
    };

    this.draw = function() {
        this.stage.draw();
    };

    this.setStage = function(name, params) {
        document.body.classList.remove(this.stage.name + "-stage");
        this.stage.end();
        game.ctx.clear();
        this.stage = new window[name + "Stage"](params);
        this.stage.name = name;
        document.body.classList.add(name + "-stage");
    };

    this.reload = function() {
        document.location.reload();
    };

    this.logout = function() {
        localStorage.setItem("login", "-");
        localStorage.removeItem("password");
        game.reload();
    };

    this.addCharacter = function(character) {
        this.characters.set(character.Name,  character);
        this.addEntity(character);
    };

    this.filter = function(type) {
        var Class = window[type];
        return this.entities.filter(function(e) {
            return e instanceof Class;
        });
    };

    this.addEntity = function(entity) {
        this.entities.set(entity.Id, entity);
        if (entity.Group == "claim")
            this.claims.set(entity.Id, entity);
    };

    this.removeEntityById = function(id) {
        if (game.containers[id]) {
            game.containers[id].panel.hide();
            delete game.containers[id];
        }

        game.sortedEntities.remove(game.entities.get(id));
        game.map.removeObject(id);
        game.entities.remove(id);
        game.claims.remove(id);
    };

    this.removeCharacterById = function(id) {
        game.map.removeObject(id);
        var c = game.entities.get(id);
        game.sortedEntities.remove(c);
        var name = c.Name;
        game.entities.remove(id);
        game.characters.remove(name);
    };

    this.findItemsNear = function(x, y, dist) {
        dist = dist || CELL_SIZE*2;
        return this.entities.filter(function(e) {
            return "inWorld" in e &&
                e.inWorld() &&
                util.distanceLessThan(e.X - x, e.Y - y, dist);
        });
    };

    this.findCharsNear = function(x, y, dist) {
        dist = dist || CELL_SIZE*2;
        return this.characters.filter(function(e) {
            return util.distanceLessThan(e.X - x, e.Y - y, dist);
        });
    };

    this.exit = function(message) {
        this.setStage("exit", message);
    };

    this.sendError = function(msg) {
        game.network.send("error", {msg: msg});
    };

    this.sendErrorf = function() {
        this.sendError(sprintf.apply(window, arguments));
    };

    function openLink(link) {
        return function() {
            window.open(link, "_blank");
            return false;
        };
    }

    this.button = {
        blog: function() {
            var link = document.createElement("button");
            link.textContent = T("Blog");
            link.onclick = openLink("//tatrix.org");
            return link;
        },
        vk: function() {
            var vk = document.createElement("button");
            var vkLogo = document.createElement("img");
            vkLogo.src = "//vk.com/favicon.ico";
            vk.appendChild(vkLogo);
            vk.appendChild(document.createTextNode(T("Group")));
            vk.onclick = openLink("//vk.com/rogalik_mmo");
            return vk;
        },
        twitter: function() {
            var twitter = document.createElement("button");
            var twitterLogo = document.createElement("img");
            twitterLogo.src = "//twitter.com/favicon.ico";
            twitter.appendChild(twitterLogo);
            twitter.appendChild(document.createTextNode(T("Twitter")));
            twitter.onclick = openLink("//twitter.com/Tatrics");
            return twitter;
        },
        wiki: function() {
            var wiki = document.createElement("button");
            wiki.textContent = T("Wiki / FAQ");
            wiki.onclick = openLink("wiki/");
            return wiki;
        },
        forum: function() {
            var forum = document.createElement("button");
            forum.textContent = T("Forum");
            forum.onclick = openLink("forum/");
            return forum;
        },
        bugtracker: function() {
            var bugtracker = document.createElement("button");
            bugtracker.textContent = T("Bugtracker")
            bugtracker.onclick = openLink("/wiki/index.php/Bugtracker");
            return bugtracker;
        },
        logout: function() {
            var logout = document.createElement("button");
            logout.textContent = T("Logout");
            logout.onclick = game.logout;
            return logout;
        },
        authors: function() {
            var authors = document.createElement("button");
            authors.textContent = T("Authors");

            var links = [
                ["Code", "TatriX", "http://vk.com/tatrix"],
                ["Animation", "igorekv", "http://vk.com/igorekv"],
                ["Music", "Иван Кельт", "http://vk.com/icelt"],

            ].map(function(tuple) {
                var title = document.createElement("cite");
                title.textContent = tuple[0];

                var link = document.createElement("a");
                link.innerHTML = tuple[1];
                link.href = tuple[2];
                link.target = "_blank";

                var label = document.createElement("div");
                label.appendChild(title);
                label.appendChild(link);

                return label;
            });

            var p = new Panel("authors",  "authors", links);
            authors.onclick = function() {
                p.show();
            };
            return authors;
        },
    };

    this.makeSendButton = function(title, cmd, args, callback) {
        var button = document.createElement("button");
        button.textContent = T(title);
        button.onclick = function() {
            game.network.send(cmd, args, callback);
        };
        return button;
    };

    this.error = function() {
        console.error.apply(console, arguments);
        console.trace();
        game.sendError("Game error:|" + [].join.call(arguments, "|"));
        game.exit();
        throw "Fatal error";
    };

    this.stage = new Stage();
    this.setStage("connecting");

    window.onerror = function(msg, url, line) {
        window.onerror = null;
        game.sendError([
            "Client error:",
            msg,
            "Url: " + url,
            "Line: " + line,
            "UA: " + navigator.userAgent,
        ].join("|"));
        game.exit(T("Client error. Refresh page or try again later."));
        return false;
    };

    function tick(currentTime) {
        game.controller.fpsStatsBegin();

        game.update(currentTime);
        game.draw();
        game.controller.fpsStatsEnd();

        requestAnimationFrame(tick);
    };

    tick();

    util.skewer();
};
