/*
 * src:
 * https://github.com/blaulichtSMS/docs/blob/master/dashboard_api_v1.md
 * https://github.com/node-red/node-red-nodes/blob/master/io/snmp/snmp.html
 * https://nodered.org/docs/creating-nodes/status
 */
module.exports = function (RED) {

    /**
     * @param config
     */
    function BlSmsNodeDash(config) {
        RED.nodes.createNode(this, config);

        this.host = "https://api.blaulichtsms.net/blaulicht/";
        this.api = "api/alarm/v1/dashboard/";
        this.login = "api/alarm/v1/dashboard/login";
        this.kid = config.kid;
        this.user = config.user;
        this.pass = config.password;
        this.updateOnly = config.updateOnly;
        this.timer = config.timer * 1000;
        this.sessionKey = null;
        this.prevData = {};

        let Client = require('node-rest-client').Client;
        this.client = new Client();

        let node = this;
        this.status({fill: "grey", shape: "ring", text: "disconnected"});

        let i = 0;
        let apiEndpoint;
        node.tout = setInterval(function () {
            //if( i++ == 10) node.sessionKey += 'a'; //  simulate expired key

            // request Api Key if not set
            if (!node.sessionKey) {
                apiEndpoint = node.host + node.login;
                let args = {
                    data: {
                        username: node.user,
                        password: node.pass,
                        customerId: node.kid
                    },
                    headers: {"Content-Type": "application/json"}
                };

                node.client.post(apiEndpoint, args, function (data, response) {
                    //console.log("BlSms login:"+response.statusCode);
                    if (data.error === null) {
                        node.sessionKey = data.sessionId;
                        //console.log("BlSms login: got session ID");
                        node.status({fill: "green", shape: "dot", text: "session OK"});
                    } else {
                        if (data.error) {
                            //console.log("BlSms login: got error message "+data.error);
                            node.status({fill: "red", shape: "dot", text: "session Err: " + data.error});
                        } else {
                            //console.log("BlSms login: http code "+response.statusCode);
                            node.status({fill: "red", shape: "dot", text: "connection Err: " + response.statusCode});
                        }
                    }
                });
            }
            // request data
            if (node.sessionKey) {
                node.status({fill: "green", shape: "ring", text: "requesting"});
                apiEndpoint = node.host + node.api + node.sessionKey;
                node.client.get(apiEndpoint, function (data, response) {
                    if (response.statusCode === 200) {
                        node.status({fill: "green", shape: "dot", text: "received data"});
                        //console.log("BlSms data: got data");
                        if (node.updateOnly) {
                            //console.log("updating only");
                            if (!equalObject(data, node.prevData)) {
                                node.send({payload: data});
                            }
                        } else {
                            //console.log("send every");
                            node.send({payload: data});
                        }
                        node.prevData = data;
                    } else {
                        node.sessionKey = null;
                        //console.log("BlSms data: http code "+response.statusCode);
                        node.status({fill: "red", shape: "ring", text: "connection Err: " + response.statusCode});
                    }
                });
            }
        }, node.timer);

        this.on("close", function () {
            if (this.tout) {
                clearInterval(this.tout);
            }
        });

        /**
         * Compares two objects for equality
         *
         * @param a object1
         * @param b object2
         * @return bool
         */
        function equalObject(a, b) {
            for (let key in a) {
                if (a.hasOwnProperty(key) !== b.hasOwnProperty(key)) {
                    return false;
                }
                let value = a[key];
                let value2 = b[key];

                switch (typeof (value)) {
                    case 'object':
                        if (!equalObject(value, value2)) {
                            return false;
                        }
                        break;
                    case 'function':
                        if (typeof (value2) == 'undefined' || value.toString() != value2.toString()) {
                            return false;
                        }
                        break;
                    default:
                        if (value != value2) {
                            return false;
                        }
                }
            }
            for (key in b) {
                if (typeof (a[key]) == 'undefined') {
                    return false;
                }
            }
            return true;
        }
    }

    RED.nodes.registerType("bl-sms-dash", BlSmsNodeDash);
};
