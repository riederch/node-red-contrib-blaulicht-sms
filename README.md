# Node-Red-Contrib-Blaulicht-SMS
Node-Red-Contrib-Blaulicht-SMS ist eine Node-Red Integration für die [BlaulichtSMS API](https://github.com/blaulichtSMS/docs).

Man kann damit, z.B. am Raspberry Pi, Alarme oder Infos empfangen und damit was auch immer anstellen :)  
Ein Beispiel wäre das Schalten von Monitoren über HDMI mit [Node-Red-Contrib-Cec](https://github.com/damoclark/node-red-contrib-cec).

#### Momentan ist ein Node implementiert:  
![BlaulichtSMS Dashboard Node](https://raw.githubusercontent.com/riederch/node-red-contrib-blaulicht-sms/develop/examples/blsms-dash-node1.png)
##### Am Output erwartet euch:
```
msg.payload: {
                 "customerId" : "123456",
                 "customerName" : "FF Test",
                 "username" : "einsatzmonitor",
                 "integrations" : [ ], // Liste an Integrationen
                 "alarms" : [ ], // Liste von AlarmData Elementen
                 "infos" : [ ] // List von AlarmData Elementen
             }
```
Nähere Infos unter [Dasboard Informationen](https://github.com/blaulichtSMS/docs/blob/master/dashboard_api_v1.md#dasboard-informationen).

#### Als Zugangsdaten werden die eures Einsatzmonitors verwendet (oder der Token):
![BlaulichtSMS Dashboard Node Config](https://raw.githubusercontent.com/riederch/node-red-contrib-blaulicht-sms/develop/examples/blsms-dash-node-config1.png)  
Das Abfrageintervall ist frei wählbar und der Node kann kontinuierlich oder nur nach Änderungen eine Message weitersenden.

# Installation
Download und Unzip vom Repository (noch nicht auf NPM)
```
mkdir ~/install_tmp
cd ~/install_tmp
git clone https://github.com/riederch/node-red-contrib-blaulicht-sms.git
npm pack node-red-contrib-blaulicht-sms/
mv ~/install_tmp/node-red-contrib-blaulicht-sms-0.2.0.tgz ~/node-red-contrib-blaulicht-sms-0.2.0.tgz
cd ~
rm -rf ~/install_tmp
```

Danach übers Menü importieren:
<img width="354" alt="grafik" src="https://user-images.githubusercontent.com/11293087/134506930-466323dc-edc6-45aa-9496-64b4c168c9c4.png">
<img width="781" alt="grafik" src="https://user-images.githubusercontent.com/11293087/134507022-a217830a-3ca3-4635-be3f-2e7c7ddfce77.png">


# Geplant:
* Node für die Alarm API
