updateStatusesInfo(); // Display info on page load

async function getDataFromAPI(queryType) {
    /* GETs '/api' to trigger the back end to get info from github API */

    let data = await fetch(`/api?queryType=${queryType}`);
    data = await data.json();           // Convert data to json to avoid getting 'readable stream' object
    return data;
}

async function updateStatusesInfo(thresholdInDays = 7) {
    /* Gets new data from github API and displays it */

    /* Parallel async calls and await all: https://stackoverflow.com/a/35612484 */
    let [issues, commits, pulls, collaborators] = await Promise.all([
        getDataFromAPI('issues'),
        getDataFromAPI('commits'),
        getDataFromAPI('pulls'),
        getDataFromAPI('collaborators')
    ]);

    issues = issues['data']['organization']['repositories']['nodes'];
    commits = commits['data']['organization']['repositories']['nodes'];
    pulls = pulls['data']['organization']['repositories']['nodes'];
    collaborators = collaborators['data']['organization']['repositories']['nodes'];

    let repos = issues;

    const list= document.getElementById('list');
    let nullNames = [];                 // Commits with no registered user as author
    let showNullNameWarning = false;    // Bool for showing a warning for incomplete data
    let listItemsData = [];             // Filtered data used to build the list

    /* Clear list */
    while(list.firstChild) { list.removeChild(list.lastChild) }

    /* Iterate through every repo in organization */
    for(let repoIncrement in repos) {
        /* Filter and display data for each collaborator */
        for(let i in collaborators[repoIncrement]['collaborators']['nodes']) {
            const username = `${collaborators[repoIncrement]['collaborators']['nodes'][i]['login']}`;
            const avatarURL = `${collaborators[repoIncrement]['collaborators']['nodes'][i]['avatarUrl']}`;
            const name = `${collaborators[repoIncrement]['collaborators']['nodes'][i]['name']}`;
            let issuesNo = 0;               // Number of authored issues
            let issuesAssignedNo = 0;       // Number of issues assigned to user
            let commitsNo = 0;              // Number of all authored commits
            let mainCommitsNo = 0;          // Number of authored commits in 'main'
            let pullsNo = 0;                // Number of authored pull requests
            let pullsAssignedNo = 0;        // Number of pull requests assigned to user
            let reviewsNo = 0;              // Number of authored code reviews (comments in review threads in PR)
            let reviewParticipationsNo = 0; // Number of authored code reviews (comments in review threads in PR)
            let commentsIssuesNo = 0;       // Number of authored code comments in issues
            let commentsPullsNo = 0;        // Number of authored code comments in pull requests
            let scannedCommits = [];        // Helps with preventing duplicate data

            /* Add user to list creation list if not in it */
            if(listItemsData.findIndex(el => el.username === username) === -1) { listItemsData[i] = { 'username': username }; }
            let listData = listItemsData[listItemsData.findIndex(el => el.username === username)]; // Stats for current user

            listData['avatarURL'] = avatarURL;
            listData['name'] = name;

            /* Number of authored issues */
            for(let i in issues[repoIncrement]['issues']['nodes']) {
                const issue = issues[repoIncrement]['issues']['nodes'][i];

                if(!isRelevantTime(issue['updatedAt'], thresholdInDays)) { continue; }  // Skip if older than threshold

                if(issue['author']['login'] === username) { issuesNo++; }       // Increment is user is issue author
                if(issue['assignees'] !== null) {
                    for(let j in issue['assignees']['nodes']) {
                        if (issue['assignees']['nodes'][j]['login'] === username) { issuesAssignedNo++; } // Increment if PR is assigned to user
                    }
                }
            }
            listData['issuesNo'] = (listData['issuesNo'] || 0) + issuesNo;
            listData['issuesAssignedNo'] = (listData['issuesAssignedNo'] || 0) + issuesAssignedNo;

            /* Number of authored commits */
            for(let i in commits[repoIncrement]['refs']['edges']) {
                const branch = commits[repoIncrement]['refs']['edges'][i]['node'];
                const commit = branch['target']['history']['edges'];

                /* Loop commits in branch history */
                for(let j in commit) {
                    const commitSHA = commit[j]['node']['abbreviatedOid'];

                    if(nullNames.includes(commitSHA)) { continue; }                                     // Skip commits with no registered author
                    if(scannedCommits.includes(commitSHA) && branch['name'] !== 'main') { continue; }   // Skip scanned commits if not on 'main' branch
                    if(!isRelevantTime(commit[j]['node']['committedDate'], thresholdInDays)) { continue; } // Skip if older than threshold


                    if(commit[j]['node']['author']['user'] === null) {
                        showNullNameWarning = true;
                        console.warn(`Commit: \'${commitSHA}\' author is NULL!`);   // Warn user about incomplete data
                        nullNames.push(commitSHA);                                  // Mark commit as a commit with no registered author
                    }
                    else if (commit[j]['node']['author']['user']['login'] === username) {
                        scannedCommits.includes(commitSHA) || commitsNo++;          // increment if not scanned yet
                        (branch['name'] === 'main') && mainCommitsNo++;             // increment if branch is main
                    }

                    scannedCommits.push(commitSHA);  // Mark commit as checked if branch is not main
                }
            }
            listData['commitsNo'] = (listData['commitsNo'] || 0) + commitsNo;
            listData['mainCommitsNo'] = (listData['mainCommitsNo'] || 0) + mainCommitsNo;

            /* Pull requests number */
            for(let i in pulls[repoIncrement]['pullRequests']['nodes']) {
                const pullRequest = pulls[repoIncrement]['pullRequests']['nodes'][i];

                if(!isRelevantTime(pullRequest['updatedAt'], thresholdInDays)) { continue; } // Skip if older than threshold

                if(pullRequest['author']['login'] === username) { pullsNo++; }      // Increment if user is PR author
                if(pullRequest['assignees'] !== null) {
                    for(let j in pullRequest['assignees']['nodes']) {
                        if (pullRequest['assignees']['nodes'][j]['login'] === username) { pullsAssignedNo++; } // Increment if PR is assigned to user
                    }
                }
            }
            listData['pullsNo'] = (listData['pullsNo'] || 0) + pullsNo;
            listData['pullsAssignedNo'] = (listData['pullsAssignedNo'] || 0) + pullsAssignedNo;

            /* Code reviews number */
            for(let i in pulls[repoIncrement]['pullRequests']['nodes']) {
                const pullRequest = pulls[repoIncrement]['pullRequests']['nodes'][i];

                if(pullRequest['reviews'] !== null) {
                    let reviewedPull = false;

                    for(let j in pullRequest['reviews']['nodes']) {
                        if(!isRelevantTime(pullRequest['updatedAt'], thresholdInDays)) { continue; } // Skip if older than threshold

                        if(pullRequest['reviews']['nodes'][j]['author']['login'] === username) {
                            reviewsNo++;            // Increment if review is from username
                            reviewedPull = true;    // Mark user with participation
                        }
                    }

                    if(reviewedPull) { reviewParticipationsNo++; }   // Increment review participation
                }
            }
            listData['reviewsNo'] = (listData['reviewsNo'] || 0) + reviewsNo;
            listData['reviewParticipationsNo'] = (listData['reviewParticipationsNo'] || 0) + reviewParticipationsNo;

            /* Comments in issues and PRs */
            for(let i in pulls[repoIncrement]['pullRequests']['nodes']) {
                const pullRequest = pulls[repoIncrement]['pullRequests']['nodes'][i];

                if(!isRelevantTime(pullRequest['updatedAt'], thresholdInDays)) { continue; } // Skip if older than threshold

                if(pullRequest['comments'] !== null) {
                    for(let j in pullRequest['comments']['nodes']) {
                        if(pullRequest['comments']['nodes'][j]['author']['login'] === username) { commentsPullsNo++; } // Increment if comment is from username
                    }
                }
            }
            for(let i in issues[repoIncrement]['issues']['nodes']) {
                const issue = issues[repoIncrement]['issues']['nodes'][i];

                if(!isRelevantTime(issue['updatedAt'], thresholdInDays)) { continue; } // Skip if older than threshold

                if(issue['comments'] !== null) {
                    for(let j in issue['comments']['nodes']) {
                        if(issue['comments']['nodes'][j]['author']['login'] === username) { commentsIssuesNo++; } // Increment if comment is from username
                    }
                }
            }
            listData['commentsIssuesNo'] = (listData['commentsIssuesNo'] || 0) + commentsIssuesNo;
            listData['commentsPullsNo'] = (listData['commentsPullsNo'] || 0) + commentsPullsNo;

            /* Effort-o-meter (give overall score) */
            let overallEffort =
                listData['issuesNo'] +
                listData['commitsNo'] +
                listData['pullsNo'] +
                listData['reviewParticipationsNo'] +
                listData['commentsPullsNo'] +
                listData['commentsIssuesNo'];

            let effortPreText = "Effort-o-meter:";
            let effortColor;
            let effortRating;

            if(overallEffort < 1)  { effortRating = 'No effort';          effortColor = '#FF0000'; } else
            if(overallEffort < 10) { effortRating = 'Little effort';      effortColor = '#FF6600'; } else
            if(overallEffort < 30) { effortRating = 'Some effort';        effortColor = '#FFAA00'; } else
            if(overallEffort < 50) { effortRating = 'Good effort';        effortColor = '#AAFF00'; } else
            if(overallEffort < 70) { effortRating = 'Great effort';       effortColor = '#44FF00'; } else
            if(overallEffort > 69) { effortRating = 'Outstanding effort'; effortColor = '#00FF00'; }

            listData['effortText'] = `${effortPreText} ${effortRating} (${overallEffort})`;
            listData['effortColor'] = effortColor;
        }
    }

    /* Build visual elements */
    for(let i in listItemsData) {
        let listData = listItemsData[i]; // Stats for current user

        /* List item container */
        let newListItem = document.createElement('div');
        newListItem.id = `listItem${i}`;
        newListItem.className = `listItem`;
        list.appendChild(newListItem);

        /* Avatar */
        newListItem = document.createElement('img');
        newListItem.src = listData['avatarURL'];
        newListItem.style.height = '64px';
        newListItem.style.width = '64px';
        document.getElementById(`listItem${i}`).appendChild(newListItem);

        /* Login and name */
        newListItem = document.createElement('a');
        newListItem.href= `https://github.com/${listData['username']}`;
        newListItem.innerText = `${listData['username']} ${listData['name'] !== "null" ? '(' + listData['name'] + ')' : ""}`;
        document.getElementById(`listItem${i}`).appendChild(newListItem);

        /* Authored issues */
        newListItem = document.createElement('p');
        newListItem.innerText = `Authored issues: ${listData['issuesNo']} (assigned: ${listData['issuesAssignedNo']})`;
        document.getElementById(`listItem${i}`).appendChild(newListItem);

        /* Authored commits */
        newListItem = document.createElement('p');
        newListItem.innerText = `Authored commits: ${listData['commitsNo']} (main: ${listData['mainCommitsNo']})`;
        document.getElementById(`listItem${i}`).appendChild(newListItem);

        /* Pull requests */
        newListItem = document.createElement('p');
        newListItem.innerText = `Authored pull requests: ${listData['pullsNo']} (assigned: ${listData['pullsAssignedNo']})`;
        document.getElementById(`listItem${i}`).appendChild(newListItem);

        /* Code reviews */
        newListItem = document.createElement('p');
        newListItem.innerText = `Authored code reviews: ${listData['reviewParticipationsNo']} (review comments: ${listData['reviewsNo']})`;
        document.getElementById(`listItem${i}`).appendChild(newListItem);

        /* Comments in issues and PRs */
        newListItem = document.createElement('p');
        newListItem.innerText = `Authored comments: ${listData['commentsIssuesNo'] + listData['commentsPullsNo']} (in issues: ${listData['commentsIssuesNo']}) (in PRs: ${listData['commentsPullsNo']})`;
        document.getElementById(`listItem${i}`).appendChild(newListItem);

        /* Effort-o-meter (give overall score) */
        newListItem = document.createElement('p');
        newListItem.innerText = listData['effortText'];
        newListItem.style.color = listData['effortColor'];
        document.getElementById(`listItem${i}`).appendChild(newListItem);
    }

    if(showNullNameWarning) {
        /* Show visual warning if some commits have 'null' as the authoring user */
        document.getElementById('nullNameWarning').style.display = 'block';
    } else {
        document.getElementById('nullNameWarning').style.display = 'none';
    }
}

function isRelevantTime(time, threshold) {
    /* Checks if date is within the threshold of being relevant.
     * This function checks for example if a date is more than 7 days
     * old, if it is, then it will return true, otherwise will return
     * false.
     */

    const now = new Date().getTime();           // Current time
    const then = new Date(time).getTime();      // Time to test
    threshold= threshold* 24 * 60 * 60 * 1000;  // Days = days * hours * minutes * seconds * milliseconds

    if((now - then) < threshold) { return true; }     // Return true if time difference is within the threshold

    return false;   // Return false, because the above 'if' statement failed
}
