import { createWriteStream } from 'fs'

import makeWASocket, { 
  DisconnectReason, 
  useMultiFileAuthState,
  getContentType,
  downloadMediaMessage,
} from '@whiskeysockets/baileys'

import qrcode from 'qrcode-terminal'


export async function connectToWhatsApp() {
  const SAFELIST = JSON.parse(process.env.SAFELIST || '[]');

  const { state, saveCreds } = await useMultiFileAuthState('auth_info')

  const sock = makeWASocket({
    auth: state,
    version: [2, 3000, 1033893291], // avoid Connection Failure
    // printQRInTerminal: true // deprecated
  })

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      console.log('💡 Scan the QR Code below with your WhatsApp:')
      qrcode.generate(qr, { small: true })
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut
      console.log('Connection closed due to an error, reconnecting...', shouldReconnect)
      if (shouldReconnect) {
        connectToWhatsApp()
      }
    } else if (connection === 'open') {
      console.log('✅ Connection opened successfully!')
    }
  })

  sock.ev.on('messages.upsert', async (m) => {
    console.log('Receiving message event...')
    
    const msg = m.messages[0]
    if (!msg?.message) {
      console.log('Empty message received...')
      return
    }

    const messageType = getContentType(msg.message)
    if (!messageType) {
      console.error('Message type not found...')
      return
    }

    if (messageType === 'imageMessage') {
      const stream = await downloadMediaMessage(
        msg,
        'stream',
        { },
        {
          logger: sock.logger,
          reuploadRequest: sock.updateMediaMessage
        }
      )
      const writeStream = createWriteStream(`./file_${Date.now()}.jpeg`)
      stream.pipe(writeStream)
    }

    const from = msg.key.remoteJid
    if (from && msg.key.fromMe === false && SAFELIST.includes(from)) {
    } else {
      console.log(`⚠️ Message from [${from}] ignored`)
    }

    console.debug(`DEBUG [${from}]: ${JSON.stringify(msg, null, 2)}`)
  })

  sock.ev.on('creds.update', saveCreds)
}
