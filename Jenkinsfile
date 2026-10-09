// CI: headless tests and the bot-vs-bot check in the Dockerfile's `test` image, then build the
// nginx image and smoke-test it. Needs an agent with the docker CLI and a reachable daemon, and the
// JUnit plugin. Nothing is pushed or deployed; both images are removed after the build.
pipeline {
  agent any
  options {
    buildDiscarder(logRotator(numToKeepStr: '20'))
    timeout(time: 20, unit: 'MINUTES')
  }
  environment {
    // Unique per job/branch/build; valid as a docker image tag and container name
    CI_ID = "${env.BUILD_TAG.toLowerCase().replaceAll('[^a-z0-9_.-]', '-')}"
  }
  stages {
    stage('Test image') {
      steps {
        sh 'docker build --target test -t "aoe-knockout-test:$CI_ID" .'
      }
    }
    stage('Unit tests') {
      steps {
        sh '''
          docker run --name "$CI_ID-test" "aoe-knockout-test:$CI_ID" node --test --test-reporter=spec --test-reporter-destination=stdout --test-reporter=junit --test-reporter-destination=/tmp/junit.xml 'test/*.test.js'
        '''
      }
      post {
        always {
          sh 'rm -rf reports && mkdir reports && docker cp "$CI_ID-test:/tmp/junit.xml" reports/junit.xml || true'
          junit allowEmptyResults: true, testResults: 'reports/junit.xml'
        }
      }
    }
    stage('Bot sim') {
      // 12 seeds x 5 rounds of bot vs bot: every match must end cleanly within its tick cap
      steps {
        sh 'docker run --name "$CI_ID-botsim" "aoe-knockout-test:$CI_ID" node test/bot-sim.js 12'
      }
    }
    stage('App image') {
      steps {
        sh 'docker build -t "aoe-knockout:$CI_ID" .'
      }
    }
    stage('Smoke test') {
      // Checks from inside the container, so it also works when Jenkins itself runs in docker
      steps {
        sh '''
          docker run -d --name "$CI_ID-web" "aoe-knockout:$CI_ID"
          for i in $(seq 1 20); do
            docker exec "$CI_ID-web" wget -q -O /dev/null http://127.0.0.1/ && break
            sleep 1
          done
          check() {
            headers=$(docker exec "$CI_ID-web" wget -S -O /dev/null "http://127.0.0.1$1" 2>&1) || { echo "$headers"; echo "FAIL $1"; exit 1; }
            echo "$headers" | grep -qi "content-type: .*$2" || { echo "$headers"; echo "FAIL $1: expected $2"; exit 1; }
            echo "ok $1 ($2)"
          }
          check / text/html
          check /styles.css text/css
          check /src/main.js javascript
          # the import map's two three.js paths: catches a Dockerfile COPY that no longer matches index.html
          check /node_modules/three/build/three.module.js javascript
          check /node_modules/three/examples/jsm/utils/BufferGeometryUtils.js javascript
        '''
      }
    }
  }
  post {
    always {
      sh '''
        docker rm -f "$CI_ID-test" "$CI_ID-botsim" "$CI_ID-web" >/dev/null 2>&1 || true
        docker rmi "aoe-knockout-test:$CI_ID" "aoe-knockout:$CI_ID" >/dev/null 2>&1 || true
      '''
    }
  }
}
