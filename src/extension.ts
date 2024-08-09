import * as vscode from 'vscode';

export const DEFAULT_SITTING_INTERVAL = 1; // Updated sitting interval to 5 minutes for demonstration
export const DEFAULT_STANDING_INTERVAL = 1;
export function activate(context: vscode.ExtensionContext): void {
  const INACTIVE_THRESHOLD = 30;
  let sittingInterval: number =
    vscode.workspace.getConfiguration().get('climbr.sittingInterval') ??
    DEFAULT_SITTING_INTERVAL; // Default to 5 minutes
  let standingInterval: number =
    vscode.workspace.getConfiguration().get('climbr.standingInterval') ??
    DEFAULT_STANDING_INTERVAL; // Default to 1 minute

  let isUserActive = true;
  let lastActiveTime = Date.now();
  let standingUpInterval: NodeJS.Timeout | undefined;
  let statusBarItem: vscode.StatusBarItem;

  let isAlreadyStanding = false;
  let standingTimer: NodeJS.Timeout | undefined;
  const getCurrentDateTime = (): string => {
    return new Date().toLocaleTimeString();
  };

  const getStatusBarText = (minutes: number, isSitting: boolean): string => {
    const minuteText = minutes === 1 ? 'minute' : 'minutes';
    return isSitting
      ? `Sit down in: ${minutes} ${minuteText}`
      : `Stand up in: ${minutes} ${minuteText}`;
  };

  function updateStatusBar(minutes: number, isSitting: boolean): void {
    if (statusBarItem) {
      statusBarItem.text = getStatusBarText(minutes, isSitting);
      statusBarItem.show();
    } else {
      statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
        100
      );
      statusBarItem.text = getStatusBarText(minutes, isSitting);
      statusBarItem.show();
    }
  }

  function clearStatusBar(): void {
    if (statusBarItem) {
      statusBarItem.hide();
    }
  }

  function updateSitDownAlertTimer(): void {
    if (standingTimer) {
      clearTimeout(standingTimer);
    }
    standingTimer = setTimeout(() => {
      vscode.window.showInformationMessage(
        `It's time to sit down! - @${getCurrentDateTime()}`
      );
      isAlreadyStanding = false;
      resetStandingUpTimer();
    }, sittingInterval * 60 * 1000); // Convert sittingInterval to milliseconds
  }

  function startStandingTimer(): void {
    if (!isAlreadyStanding) {
      isAlreadyStanding = true;
      updateSitDownAlertTimer();
    }
  }

  function resetStandingUpTimer(): void {
    if (standingUpInterval) {
      clearInterval(standingUpInterval);
    }

    let remainingMinutes = isUserActive
      ? standingInterval
      : Math.max(
          0,
          standingInterval - Math.floor((Date.now() - lastActiveTime) / 60000)
        );
    updateStatusBar(remainingMinutes, isAlreadyStanding);

    standingUpInterval = setInterval(() => {
      if (isUserActive) {
        remainingMinutes--;
        updateStatusBar(remainingMinutes, isAlreadyStanding);
        if (remainingMinutes === 0) {
          //current time in readable format

          vscode.window.showInformationMessage(
            `It's time to stand up! - @${getCurrentDateTime()}`
          );
          clearStatusBar();
          startStandingTimer(); // Start the standing timer when the user stands up
          resetStandingUpTimer();
        }
      }
      if (!isUserActive) {
        if (Date.now() - lastActiveTime > INACTIVE_THRESHOLD * 60000) {
          clearInterval(standingUpInterval);
        }
      }
    }, 60 * 1000); // Update the status bar every 1 minute
  }

  vscode.workspace.onDidChangeTextDocument(() => {
    isUserActive = true;
    lastActiveTime = Date.now();
    clearStatusBar();
    resetStandingUpTimer();
    if (isAlreadyStanding) {
      updateSitDownAlertTimer();
    }
  });

  vscode.window.onDidChangeTextEditorSelection(() => {
    isUserActive = true;
    lastActiveTime = Date.now();
    clearStatusBar();
    resetStandingUpTimer();
    if (isAlreadyStanding) {
      updateSitDownAlertTimer();
    }
  });

  resetStandingUpTimer();

  vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration('climbr.sittingInterval')) {
      sittingInterval =
        vscode.workspace.getConfiguration().get('climbr.sittingInterval') ??
        DEFAULT_SITTING_INTERVAL;
      clearStatusBar();
    }
    if (event.affectsConfiguration('climbr.standingInterval')) {
      standingInterval =
        vscode.workspace.getConfiguration().get('climbr.standingInterval') ??
        DEFAULT_STANDING_INTERVAL;
      resetStandingUpTimer();
    }
  });

  context.subscriptions.push({
    dispose: () => {
      if (standingUpInterval) {
        clearInterval(standingUpInterval);
      }
      clearStatusBar();
    },
  });

  let disposable = vscode.commands.registerCommand(
    'climbr.startReminder',
    () => {
      resetStandingUpTimer();
      vscode.window.showInformationMessage(
        `Stand-up reminder started! - @${getCurrentDateTime()}`
      );
    }
  );

  context.subscriptions.push(disposable);

  vscode.commands.executeCommand('climbr.startReminder');
}

export function deactivate() {}
