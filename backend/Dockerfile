FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY Simulyn.Api/Simulyn.Api.csproj Simulyn.Api/
COPY Simulyn.Api/ Simulyn.Api/
RUN dotnet publish Simulyn.Api/Simulyn.Api.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "Simulyn.Api.dll"]
