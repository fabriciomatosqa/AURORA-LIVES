#define AppName "AURORA LIVES"
#define AppVersion GetEnv("AURORA_VERSION")
#if AppVersion == ""
  #error "AURORA_VERSION must come from package.json before building."
#endif
#define AppExeName "aurora-lives.exe"
#define AppPublisher "Fabricio Matos"

[Setup]
SourceDir=..\..
AppId={{842516D8-2E41-465B-9476-A46465943A8D}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} v{#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL=https://github.com/fabriciomatosqa/AURORA-LIVES
AppSupportURL=https://github.com/fabriciomatosqa/AURORA-LIVES/issues
DefaultDirName={localappdata}\Programs\AURORA LIVES
DefaultGroupName={#AppName}
UsePreviousAppDir=yes
UsePreviousGroup=yes
UsePreviousTasks=yes
DisableProgramGroupPage=yes
ShowLanguageDialog=no
OutputDir=installer-win
OutputBaseFilename=AURORA-LIVES-Windows-x64-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
CloseApplications=yes
RestartApplications=no
SetupLogging=yes
SetupIconFile=src-tauri\icons\icon.ico
UninstallDisplayIcon={app}\{#AppExeName}
VersionInfoVersion={#AppVersion}.0
VersionInfoDescription=Instalador do AURORA LIVES
VersionInfoCompany={#AppPublisher}
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Criar atalho na área de trabalho"; GroupDescription: "Atalhos:"; Flags: unchecked

[Files]
Source: "src-tauri\target\release\aurora-lives.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\AURORA LIVES"; Filename: "{app}\{#AppExeName}"
Name: "{autodesktop}\AURORA LIVES"; Filename: "{app}\{#AppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#AppExeName}"; Description: "Executar AURORA LIVES"; Flags: nowait postinstall skipifsilent; Check: not IsAuroraUpdate
Filename: "{app}\{#AppExeName}"; Flags: nowait runasoriginaluser; Check: IsAuroraUpdate

[Code]
function IsAuroraUpdate: Boolean;
begin
  { Never auto-install without a user confirmation from the app. }
  Result := ExpandConstant('{param:AURORAUPDATE|0}') = '1';
end;
