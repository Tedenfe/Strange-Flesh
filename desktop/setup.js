'use strict';
const bridge = window.strangeFleshDesktop;
const button = document.getElementById('choose');
const status = document.getElementById('status');
const portuguese = navigator.language.toLowerCase().startsWith('pt');
if (portuguese) {
    document.documentElement.lang = 'pt-BR';
    document.getElementById('intro').textContent = 'Escolha o arquivo Strange-Flesh-Media-v1.4.zip que você baixou para jogar.';
    document.getElementById('detail').textContent = 'As imagens e o áudio são importados uma vez e ficam neste computador para as próximas versões.';
    document.getElementById('hint').textContent = 'Use o pacote de mídia original indicado no README do projeto.';
    button.textContent = 'Escolher ZIP de mídia';
}
bridge.onImportProgress(count => { status.textContent = (portuguese ? 'Importando arquivos: ' : 'Importing files: ') + count; });
button.addEventListener('click', async () => {
    button.disabled = true;
    status.textContent = portuguese ? 'Escolhendo e verificando o pacote de mídia…' : 'Choosing and checking the media pack…';
    try {
        const result = await bridge.importMedia();
        if (result.canceled) status.textContent = '';
        else if (!result.ok) status.textContent = result.error || (portuguese ? 'Não foi possível importar o pacote.' : 'Unable to import the media pack.');
    } catch { status.textContent = portuguese ? 'Não foi possível importar o pacote.' : 'Unable to import the media pack.'; }
    finally { button.disabled = false; }
});
